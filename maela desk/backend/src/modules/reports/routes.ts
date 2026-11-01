import { Router } from "express";
import { prisma } from "../../config/database.js";
import { forbidden } from "../../errors/app-error.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { reportRateLimit } from "../../middleware/rate-limit.js";
import { validateQuery } from "../../middleware/validate.js";
import { resolveLocale } from "../../services/localization.js";
import { ticketScopeWhere } from "../tickets/service.js";
import { reportRangeQuery } from "../tickets/schemas.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { z } from "zod";

export const reportRouter = Router();
reportRouter.use(requireAuthentication, reportRateLimit);

const statusLabel = (status: string, locale: "en" | "am") => {
  const labels = {
    en: { OPEN: "Open", IN_PROGRESS: "In progress", PENDING_REQUESTER: "Pending requester", PENDING_THIRD_PARTY: "Pending third party", RESOLVED: "Resolved", CLOSED: "Closed" },
    am: { OPEN: "ክፍት", IN_PROGRESS: "በሂደት ላይ", PENDING_REQUESTER: "የተጠቃሚ ተመላሽ", PENDING_THIRD_PARTY: "የሦስተኛ ወገን ተመላሽ", RESOLVED: "ተፈትቷል", CLOSED: "ተዘግቷል" },
  } as const;
  return labels[locale][status as keyof typeof labels.en] ?? status;
};

const priorityLabel = (code: string, locale: "en" | "am") => {
  const labels = {
    en: { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" },
    am: { LOW: "ዝቅተኛ", NORMAL: "መደበኛ", HIGH: "ከፍተኛ", URGENT: "አስቸኳይ" },
  } as const;
  return labels[locale][code as keyof typeof labels.en] ?? code;
};

function rangeWhere(user: NonNullable<Express.Request["authUser"]>, input: z.infer<typeof reportRangeQuery>) {
  if (user.role === "REQUESTER" || user.role === "AGENT") throw forbidden();
  if (input.teamId && user.role !== "ADMIN" && !user.teamIds.includes(input.teamId)) throw forbidden();
  if (input.departmentId && user.role !== "ADMIN" && input.departmentId !== user.departmentId) throw forbidden();
  const to = input.to ?? new Date();
  const from = input.from ?? new Date(to.getTime() - input.days * 86400000);
  const scope = ticketScopeWhere(user);
  const and: Prisma.TicketWhereInput[] = [scope, { createdAt: { gte: from, lte: to } }];
  if (input.teamId) and.push({ assignedTeamId: input.teamId });
  if (input.departmentId) and.push({ departmentId: input.departmentId });
  return { where: { deletedAt: null, AND: and } satisfies Prisma.TicketWhereInput, from, to };
}

async function summary(user: NonNullable<Express.Request["authUser"]>, input: z.infer<typeof reportRangeQuery>, locale: "en" | "am") {
  const { where, from, to } = rangeWhere(user, input);
  const [total, groupedStatus, groupedPriority, groupedCategory, groupedAgent, records, slaTotal, slaBreached, reopened] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["priorityId"], where, _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["categoryId"], where, _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["assignedAgentId"], where: { ...where, assignedAgentId: { not: null } }, _count: { _all: true } }),
    prisma.ticket.findMany({ where, select: { createdAt: true, firstResponseAt: true, resolvedAt: true }, orderBy: { createdAt: "desc" }, take: 10000 }),
    prisma.slaTracking.count({ where: { ticket: where } }),
    prisma.slaTracking.count({ where: { ticket: where, OR: [{ firstResponseBreachedAt: { not: null } }, { resolutionBreachedAt: { not: null } }] } }),
    prisma.ticketStatusHistory.count({ where: { newStatus: "IN_PROGRESS", previousStatus: "RESOLVED", ticket: where } }),
  ]);
  const priorityIds = groupedPriority.map((row) => row.priorityId);
  const categoryIds = groupedCategory.map((row) => row.categoryId);
  const agentIds = groupedAgent.map((row) => row.assignedAgentId).filter((id): id is string => Boolean(id));
  const [priorities, categories, agents] = await Promise.all([
    prisma.priority.findMany({ where: { id: { in: priorityIds } }, select: { id: true, code: true } }),
    prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, labelEn: true, labelAm: true } }),
    prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } }),
  ]);
  const dayCount = Math.max(1, Math.min(90, Math.ceil((to.getTime() - from.getTime()) / 86400000)));
  const volumeMap = new Map<string, number>();
  for (const item of records) {
    const day = item.createdAt.toISOString().slice(0, 10);
    volumeMap.set(day, (volumeMap.get(day) ?? 0) + 1);
  }
  const volume = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(from.getTime() + index * 86400000).toISOString().slice(0, 10);
    return { date, total: volumeMap.get(date) ?? 0 };
  });
  const responseTimes = records.flatMap((item) => item.firstResponseAt ? [Math.max(0, (item.firstResponseAt.getTime() - item.createdAt.getTime()) / 60000)] : []);
  const resolutionTimes = records.flatMap((item) => item.resolvedAt ? [Math.max(0, (item.resolvedAt.getTime() - item.createdAt.getTime()) / 60000)] : []);
  const avg = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  const statusById = new Map(priorities.map((item) => [item.id, item.code]));
  void statusById;

  return {
    total,
    volume,
    byStatus: groupedStatus.map((row) => ({ label: statusLabel(row.status, locale), total: row._count._all })),
    byPriority: groupedPriority.map((row) => ({ label: priorityLabel(priorities.find((item) => item.id === row.priorityId)?.code ?? "UNKNOWN", locale), total: row._count._all })),
    byCategory: groupedCategory.map((row) => {
      const category = categories.find((item) => item.id === row.categoryId);
      return { label: locale === "am" ? category?.labelAm ?? "ሌላ" : category?.labelEn ?? "Other", total: row._count._all };
    }),
    avgFirstResponseMinutes: avg(responseTimes),
    avgResolutionMinutes: avg(resolutionTimes),
    slaCompliancePct: slaTotal ? Math.round(((slaTotal - slaBreached) / slaTotal) * 1000) / 10 : null,
    reopenRatePct: total ? Math.round((reopened / total) * 1000) / 10 : null,
    agentWorkload: groupedAgent.map((row) => ({ name: agents.find((agent) => agent.id === row.assignedAgentId)?.name ?? "Unassigned", total: row._count._all })),
  };
}

reportRouter.get("/summary", validateQuery(reportRangeQuery), async (req, res) => {
  res.json(await summary(req.authUser!, req.validatedQuery as z.infer<typeof reportRangeQuery>, resolveLocale(req)));
});

reportRouter.get("/overview", validateQuery(reportRangeQuery), async (req, res) => {
  res.json(await summary(req.authUser!, req.validatedQuery as z.infer<typeof reportRangeQuery>, resolveLocale(req)));
});

reportRouter.get("/tickets", validateQuery(reportRangeQuery), async (req, res) => {
  const report = await summary(req.authUser!, req.validatedQuery as z.infer<typeof reportRangeQuery>, resolveLocale(req));
  res.json({ total: report.total, byStatus: report.byStatus, byPriority: report.byPriority, byCategory: report.byCategory, volume: report.volume });
});

reportRouter.get("/agents", validateQuery(reportRangeQuery), async (req, res) => {
  const report = await summary(req.authUser!, req.validatedQuery as z.infer<typeof reportRangeQuery>, resolveLocale(req));
  res.json({ workload: report.agentWorkload });
});

reportRouter.get("/sla", validateQuery(reportRangeQuery), async (req, res) => {
  const report = await summary(req.authUser!, req.validatedQuery as z.infer<typeof reportRangeQuery>, resolveLocale(req));
  res.json({ compliancePct: report.slaCompliancePct, avgFirstResponseMinutes: report.avgFirstResponseMinutes, avgResolutionMinutes: report.avgResolutionMinutes, breaches: report.total && report.slaCompliancePct !== null ? Math.round(report.total * (100 - report.slaCompliancePct) / 100) : 0 });
});
