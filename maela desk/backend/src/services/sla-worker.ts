import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { createNotification } from "./notifications.js";
import { writeAudit } from "./audit.js";

let sweepRunning = false;

export async function runSlaSweep(): Promise<number> {
  if (sweepRunning) return 0;
  sweepRunning = true;
  let handled = 0;
  try {
    const now = new Date();
    const records = await prisma.slaTracking.findMany({
      where: {
        pausedAt: null,
        ticket: { is: { deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] } } },
        OR: [
          { firstResponseDueAt: { lte: new Date(now.getTime() + 7 * 86400000) }, firstResponseWarningSentAt: null },
          { resolutionDueAt: { lte: new Date(now.getTime() + 7 * 86400000) }, resolutionWarningSentAt: null },
          { firstResponseDueAt: { lt: now }, firstResponseBreachedAt: null },
          { resolutionDueAt: { lt: now }, resolutionBreachedAt: null },
        ],
      },
      include: {
        ticket: {
          include: {
            priority: { include: { slaPolicy: true } },
            requester: { include: { notificationPreference: true } },
            assignedAgent: { include: { notificationPreference: true } },
            assignedTeam: { include: { members: { where: { active: true }, include: { user: { include: { notificationPreference: true } } } } } },
          },
        },
      },
      take: 100,
    });

    for (const record of records) {
      if (!record.ticket) continue;
      const warningMinutes = record.ticket.priority.slaPolicy?.warningMinutes ?? 60;
      const firstWarn = !!record.firstResponseDueAt && !record.ticket.firstResponseAt && !record.firstResponseWarningSentAt && record.firstResponseDueAt > now && record.firstResponseDueAt.getTime() - now.getTime() <= warningMinutes * 60000;
      const resolutionWarn = !!record.resolutionDueAt && !record.resolutionWarningSentAt && record.resolutionDueAt > now && record.resolutionDueAt.getTime() - now.getTime() <= warningMinutes * 60000;
      const firstBreach = !!record.firstResponseDueAt && record.firstResponseDueAt < now && !record.firstResponseBreachedAt && !record.ticket.firstResponseAt;
      const resolutionBreach = !!record.resolutionDueAt && record.resolutionDueAt < now && !record.resolutionBreachedAt;
      if (!firstWarn && !resolutionWarn && !firstBreach && !resolutionBreach) continue;

      await prisma.$transaction(async (tx) => {
        const update = await tx.slaTracking.updateMany({
          where: {
            id: record.id,
            ...(firstWarn ? { firstResponseWarningSentAt: null } : {}),
            ...(resolutionWarn ? { resolutionWarningSentAt: null } : {}),
            ...(firstBreach ? { firstResponseBreachedAt: null } : {}),
            ...(resolutionBreach ? { resolutionBreachedAt: null } : {}),
          },
          data: {
            ...(firstWarn ? { firstResponseWarningSentAt: now } : {}),
            ...(resolutionWarn ? { resolutionWarningSentAt: now } : {}),
            ...(firstBreach ? { firstResponseBreachedAt: now } : {}),
            ...(resolutionBreach ? { resolutionBreachedAt: now } : {}),
          },
        });
        if (update.count !== 1) return;

        const ticket = record.ticket;
        const recipients = [ticket.requester, ticket.assignedAgent, ...(ticket.assignedTeam?.members.map((member) => member.user) ?? [])]
          .filter((user): user is NonNullable<typeof user> => Boolean(user));
        const unique = [...new Map(recipients.map((user) => [user.id, user])).values()];
        const breached = firstBreach || resolutionBreach;
        for (const recipient of unique) {
          const locale = recipient.preferredLanguage === "am" ? "am" : "en";
          const title = breached
            ? locale === "am" ? "የSLA ጊዜ ገደብ አልፏል" : "SLA deadline breached"
            : locale === "am" ? "የSLA ጊዜ ገደብ ሊደርስ ነው" : "SLA deadline approaching";
          const message = `${ticket.ticketNumber}: ${breached ? "Service deadline exceeded." : "Service deadline is approaching."}`;
          await createNotification(tx, {
            recipientId: recipient.id,
            ticketId: ticket.id,
            type: breached ? "sla_breach" : "sla",
            title,
            message,
            locale,
            email: recipient.email,
            emailEnabled: recipient.notificationPreference?.emailEnabled ?? false,
            eventKey: `sla:${record.id}:${breached ? "breach" : "warning"}:${recipient.id}`,
          });
        }
        await writeAudit(tx, { requestId: `sla-${record.id}`, ipAddress: null, userAgent: null }, {
          actorId: null,
          action: breached ? "sla.breached" : "sla.warning",
          resourceType: "Ticket",
          resourceId: ticket.id,
          afterData: { firstBreach, resolutionBreach, firstWarn, resolutionWarn },
        });
      });
      handled += 1;
    }
  } finally {
    sweepRunning = false;
  }
  return handled;
}

export function startSlaWorker(): NodeJS.Timeout {
  const timer = setInterval(() => {
    void runSlaSweep().catch((error) => logger.error({ err: error }, "SLA worker failed"));
  }, env.SLA_INTERVAL_MS);
  timer.unref();
  return timer;
}
