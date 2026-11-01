import { createHash, randomUUID } from "node:crypto";
import type { Request } from "express";
import type { Prisma, TicketStatus } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { conflict, forbidden, notFound } from "../../errors/app-error.js";
import { assertStatusTransition, canAssignTicket, canViewTicket, parseWorkflowTransitions, requireAssignableTicket } from "../../policies/tickets.js";
import { writeAudit } from "../../services/audit.js";
import { createNotification, ticketNotificationText } from "../../services/notifications.js";
import { resolveLocale } from "../../services/localization.js";
import { calculateDeadline } from "../../services/sla-calculator.js";
import { ticketDetailInclude, ticketListInclude, toTicketDetailDto, toTicketDto } from "../../services/ticket-dto.js";
import type { AuthenticatedUser } from "../../types/express.js";
import type { assignTicketSchema, commentSchema, createTicketSchema, reportRangeQuery, resolveSchema, statusSchema, ticketListQuery, updateCommentSchema, updateTicketSchema } from "./schemas.js";
import type { z } from "zod";

type TicketListFilters = z.infer<typeof ticketListQuery>;
type CreateTicketInput = z.infer<typeof createTicketSchema>;
type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
type AssignTicketInput = z.infer<typeof assignTicketSchema>;
type StatusInput = z.infer<typeof statusSchema>;
type ResolveInput = z.infer<typeof resolveSchema>;
type CommentInput = z.infer<typeof commentSchema>;
type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export function ticketScopeWhere(user: AuthenticatedUser): Prisma.TicketWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "REQUESTER") return { requesterId: user.id };
  const visible: Prisma.TicketWhereInput[] = [{ assignedAgentId: user.id }];
  if (user.teamIds.length) visible.push({ assignedTeamId: { in: user.teamIds } });
  if (user.role === "TEAM_LEAD" && user.departmentId) visible.push({ departmentId: user.departmentId });
  return { OR: visible };
}

function listWhere(user: AuthenticatedUser, filters: TicketListFilters): Prisma.TicketWhereInput {
  const and: Prisma.TicketWhereInput[] = [ticketScopeWhere(user)];
  if (filters.q) and.push({ OR: [
    { ticketNumber: { contains: filters.q } },
    { subject: { contains: filters.q } },
  ] });
  if (filters.status) and.push({ status: filters.status });
  if (filters.priority) and.push({ priority: { code: filters.priority } });
  if (filters.categoryId) and.push({ categoryId: filters.categoryId });
  if (filters.requesterId) and.push({ requesterId: filters.requesterId });
  if (filters.teamId) and.push({ assignedTeam: { is: { OR: [{ id: filters.teamId }, { name: filters.teamId }] } } });
  if (filters.assignedAgentId) and.push({ assignedAgentId: filters.assignedAgentId });
  if (filters.departmentId) and.push({ departmentId: filters.departmentId });
  if (filters.dateFrom || filters.dateTo) and.push({ createdAt: { gte: filters.dateFrom, lte: filters.dateTo ? new Date(filters.dateTo.getTime() + 86399999) : undefined } });
  if (filters.sla === "COMPLETED" || filters.sla === "NOT_APPLICABLE") {
    and.push({ status: filters.sla === "COMPLETED" ? "RESOLVED" : "CLOSED" });
  } else if (filters.sla === "BREACHED") {
    and.push({ OR: [
      { slaTracking: { is: { resolutionBreachedAt: { not: null } } } },
      { slaTracking: { is: { resolutionDueAt: { lt: new Date() }, resolutionBreachedAt: null } } },
    ] });
  } else if (filters.sla === "AT_RISK") {
    and.push({ slaTracking: { is: { resolutionDueAt: { gte: new Date(), lte: new Date(Date.now() + 60 * 60 * 1000) }, resolutionBreachedAt: null } } });
  } else if (filters.sla === "ON_TRACK") {
    and.push({ status: { notIn: ["RESOLVED", "CLOSED"] }, slaTracking: { is: { resolutionDueAt: { gt: new Date(Date.now() + 60 * 60 * 1000) }, resolutionBreachedAt: null } } });
  }
  return { deletedAt: null, AND: and };
}

function orderBy(filters: TicketListFilters): Prisma.TicketOrderByWithRelationInput[] {
  const direction = filters.sortDir;
  if (filters.sort === "priority") return [{ priority: { level: direction } }, { updatedAt: "desc" }];
  if (filters.sort === "createdAt") return [{ createdAt: direction }, { id: "desc" }];
  return [{ updatedAt: direction }, { id: "desc" }];
}

export async function getAccessibleTicket(req: Request, user: AuthenticatedUser, ticketId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const ticket = await tx.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
  if (!ticket || !canViewTicket(user, ticket)) throw notFound();
  return ticket;
}

async function loadDetail(ticketId: string, role: AuthenticatedUser["role"], tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const detail = await tx.ticket.findFirst({ where: { id: ticketId, deletedAt: null }, include: ticketDetailInclude });
  if (!detail) throw notFound();
  return toTicketDetailDto(detail, role);
}

async function createInAppNotification(
  tx: Prisma.TransactionClient,
  req: Request,
  recipientId: string,
  ticketId: string,
  type: string,
  title: string,
  message: string,
  email?: string | null,
  emailEnabled = false,
  locale = resolveLocale(req)
) {
  await createNotification(tx, {
    recipientId,
    ticketId,
    type,
    title,
    message,
    locale,
    email,
    emailEnabled,
    eventKey: `notification:${randomUUID()}`,
  });
}

function requireStaff(user: AuthenticatedUser): void {
  if (user.role === "REQUESTER") throw forbidden();
}

export async function listTickets(user: AuthenticatedUser, filters: TicketListFilters) {
  if (filters.requesterId && user.role !== "ADMIN" && filters.requesterId !== user.id) throw forbidden();
  if (filters.departmentId && user.role !== "ADMIN" && filters.departmentId !== user.departmentId) throw forbidden();
  if (filters.teamId && user.role !== "ADMIN" && !user.teamIds.includes(filters.teamId) && user.role !== "TEAM_LEAD") throw forbidden();
  const where = listWhere(user, filters);
  const [records, total] = await prisma.$transaction([
    prisma.ticket.findMany({ where, include: ticketListInclude, orderBy: orderBy(filters), skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    prisma.ticket.count({ where }),
  ]);
  return { items: records.map(toTicketDto), total, page: filters.page, pageSize: filters.pageSize };
}

export async function getTicket(req: Request, user: AuthenticatedUser, ticketId: string) {
  await getAccessibleTicket(req, user, ticketId);
  return loadDetail(ticketId, user.role);
}

export async function createTicket(req: Request, user: AuthenticatedUser, input: CreateTicketInput) {
  const category = await prisma.category.findFirst({ where: { id: input.categoryId, active: true } });
  if (!category) throw notFound();
  const priority = await prisma.priority.findFirst({ where: { code: input.priority, active: true } });
  if (!priority) throw notFound();
  const userRecord = await prisma.user.findUnique({ where: { id: user.id }, include: { notificationPreference: true } });
  if (!userRecord?.active) throw forbidden();
  const attachmentIds = [...new Set(input.attachmentIds)];
  const now = new Date();
  const idempotencyKey = req.header("idempotency-key");
  if (idempotencyKey && !/^[a-zA-Z0-9._:-]{8,128}$/.test(idempotencyKey)) throw conflict("INVALID_IDEMPOTENCY_KEY", "The idempotency key is invalid.");
  const requestHash = createHash("sha256").update(JSON.stringify({ method: req.method, path: req.path, body: input })).digest("hex");
  try {
    return await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const prior = await tx.idempotencyRecord.findUnique({ where: { actorId_key: { actorId: user.id, key: idempotencyKey } } });
        if (prior) {
          if (prior.requestHash !== requestHash) throw conflict("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different request.");
          if (!prior.response) throw conflict("REQUEST_IN_PROGRESS", "A matching request is still being processed.");
          return prior.response as unknown as ReturnType<typeof toTicketDto>;
        }
      }
    const sequence = await tx.ticketSequence.upsert({
      where: { id: 1 },
      create: { id: 1, lastValue: 1000n },
      update: { lastValue: { increment: 1n } },
    });
    const ticketNumber = `MD-${sequence.lastValue.toString().padStart(6, "0")}`;
    const slaPolicy = await tx.slaPolicy.findUnique({ where: { priorityId: priority.id } });
    const responseDueAt = calculateDeadline(now, priority.firstResponseMinutes, slaPolicy);
    const resolutionDueAt = calculateDeadline(now, priority.resolutionMinutes, slaPolicy);
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        subject: input.subject,
        description: input.description,
        requesterId: user.id,
        departmentId: userRecord.departmentId,
        categoryId: category.id,
        priorityId: priority.id,
        service: input.service,
        impact: input.impact,
        urgency: input.urgency,
        dueAt: resolutionDueAt,
        statusHistory: { create: { previousStatus: null, newStatus: "OPEN", changedById: user.id } },
        slaTracking: { create: { firstResponseDueAt: responseDueAt, resolutionDueAt } },
      },
    });

    if (attachmentIds.length) {
      const staged = await tx.attachment.findMany({
        where: { id: { in: attachmentIds }, uploadedById: user.id, ticketId: null, deletedAt: null, expiresAt: { gt: now } },
        select: { id: true },
      });
      if (staged.length !== attachmentIds.length) throw notFound();
      await tx.attachment.updateMany({ where: { id: { in: attachmentIds } }, data: { ticketId: ticket.id, expiresAt: null } });
    }

    await createInAppNotification(
      tx, req, user.id, ticket.id, "status", ticketNotificationText(user.locale, "created"),
      `${ticketNumber} was created successfully.`, user.email, userRecord.notificationPreference?.emailEnabled ?? false, user.locale
    );
    await writeAudit(tx, req, { actorId: user.id, action: "ticket.created", resourceType: "Ticket", resourceId: ticket.id, afterData: { ticketNumber, status: ticket.status, priority: input.priority } });
      const createdView = await tx.ticket.findUnique({ where: { id: ticket.id }, include: ticketListInclude });
      if (!createdView) throw notFound();
      const response = toTicketDto(createdView);
      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            actorId: user.id,
            key: idempotencyKey,
            requestHash,
            response: response as never,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }
      return response;
    });
  } catch (error) {
    if (idempotencyKey && typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
      const prior = await prisma.idempotencyRecord.findUnique({ where: { actorId_key: { actorId: user.id, key: idempotencyKey } } });
      if (prior && prior.requestHash === requestHash && prior.response) return prior.response as unknown as ReturnType<typeof toTicketDto>;
    }
    throw error;
  }
}

export async function updateTicket(req: Request, user: AuthenticatedUser, ticketId: string, input: UpdateTicketInput) {
  const current = await getAccessibleTicket(req, user, ticketId);
  const requesterCanEdit = user.role === "REQUESTER" && current.requesterId === user.id && !current.firstResponseAt && current.status === "OPEN";
  if (user.role === "REQUESTER" && !requesterCanEdit) throw forbidden();
  const changes: Prisma.TicketUncheckedUpdateManyInput = {};
  if (input.subject !== undefined) changes.subject = input.subject;
  if (input.description !== undefined) changes.description = input.description;
  if (input.service !== undefined) changes.service = input.service;
  if (input.impact !== undefined) changes.impact = input.impact;
  if (input.urgency !== undefined) changes.urgency = input.urgency;
  if (input.categoryId !== undefined) {
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, active: true } });
    if (!category) throw notFound();
    changes.categoryId = category.id;
  }
  if (input.version !== undefined && input.version !== current.version) throw conflict("STALE_TICKET", "This ticket changed. Reload it before saving.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.updateMany({ where: { id: ticketId, version: current.version, deletedAt: null }, data: { ...changes, version: { increment: 1 } } });
    if (updated.count !== 1) throw conflict("STALE_TICKET", "This ticket changed. Reload it before saving.");
    await writeAudit(tx, req, { actorId: user.id, action: "ticket.updated", resourceType: "Ticket", resourceId: ticketId, beforeData: { subject: current.subject, categoryId: current.categoryId }, afterData: changes });
    return loadDetail(ticketId, user.role, tx);
  });
}

async function updateStatusTx(
  tx: Prisma.TransactionClient,
  req: Request,
  user: AuthenticatedUser,
  current: Awaited<ReturnType<typeof getAccessibleTicket>>,
  nextStatus: TicketStatus,
  reason?: string,
  expectedVersion?: number
) {
  if (expectedVersion !== undefined && expectedVersion !== current.version) throw conflict("STALE_TICKET", "This ticket changed. Reload it before saving.");
  const workflow = await tx.systemSetting.findUnique({ where: { key: "ticket.workflow" } });
  assertStatusTransition(current.status, nextStatus, user, parseWorkflowTransitions(workflow?.value));
  const now = new Date();
  const updated = await tx.ticket.updateMany({
    where: { id: current.id, version: current.version, deletedAt: null },
    data: {
      status: nextStatus,
      resolvedAt: nextStatus === "RESOLVED" ? now : nextStatus === "IN_PROGRESS" ? null : current.resolvedAt,
      closedAt: nextStatus === "CLOSED" ? now : nextStatus === "OPEN" ? null : current.closedAt,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) throw conflict("STALE_TICKET", "This ticket changed. Reload it before saving.");
  await tx.ticketStatusHistory.create({ data: { ticketId: current.id, previousStatus: current.status, newStatus: nextStatus, changedById: user.id, reason } });
  const slaPolicy = await tx.slaPolicy.findUnique({ where: { priorityId: current.priorityId } });
  const sla = await tx.slaTracking.findUnique({ where: { ticketId: current.id } });
  const wasPending = current.status === "PENDING_REQUESTER" || current.status === "PENDING_THIRD_PARTY";
  const isPending = nextStatus === "PENDING_REQUESTER" || nextStatus === "PENDING_THIRD_PARTY";
  if (slaPolicy?.pauseWhenPending && sla) {
    if (!wasPending && isPending && !sla.pausedAt) {
      await tx.slaTracking.update({ where: { ticketId: current.id }, data: { pausedAt: now } });
    } else if (wasPending && !isPending && sla.pausedAt) {
      const pauseMinutes = Math.max(0, Math.floor((now.getTime() - sla.pausedAt.getTime()) / 60000));
      const pauseMs = pauseMinutes * 60000;
      await tx.slaTracking.update({
        where: { ticketId: current.id },
        data: {
          pausedAt: null,
          accumulatedPauseMinutes: { increment: pauseMinutes },
          firstResponseDueAt: sla.firstResponseDueAt && !current.firstResponseAt ? new Date(sla.firstResponseDueAt.getTime() + pauseMs) : sla.firstResponseDueAt,
          resolutionDueAt: sla.resolutionDueAt ? new Date(sla.resolutionDueAt.getTime() + pauseMs) : null,
        },
      });
      if (sla.resolutionDueAt) await tx.ticket.update({ where: { id: current.id }, data: { dueAt: new Date(sla.resolutionDueAt.getTime() + pauseMs) } });
    }
  }
  await writeAudit(tx, req, { actorId: user.id, action: "ticket.status.changed", resourceType: "Ticket", resourceId: current.id, beforeData: { status: current.status }, afterData: { status: nextStatus, reason } });
  const requester = await tx.user.findUnique({ where: { id: current.requesterId }, select: { email: true, preferredLanguage: true, notificationPreference: { select: { emailEnabled: true, statusEnabled: true } } } });
  if (requester && requester.notificationPreference?.statusEnabled !== false) {
    const locale = requester.preferredLanguage === "am" ? "am" : "en";
    await createInAppNotification(tx, req, current.requesterId, current.id, "status", ticketNotificationText(locale, nextStatus === "RESOLVED" ? "resolved" : "status"), `${current.ticketNumber}: ${current.status} → ${nextStatus}`, requester.email, requester.notificationPreference?.emailEnabled ?? false, locale);
  }
}

export async function changeTicketStatus(req: Request, user: AuthenticatedUser, ticketId: string, input: StatusInput) {
  requireStaff(user);
  const current = await getAccessibleTicket(req, user, ticketId);
  return prisma.$transaction(async (tx) => {
    await updateStatusTx(tx, req, user, current, input.status, input.reason, input.version);
    return loadDetail(ticketId, user.role, tx);
  });
}

export async function resolveTicket(req: Request, user: AuthenticatedUser, ticketId: string, input: ResolveInput) {
  requireStaff(user);
  const current = await getAccessibleTicket(req, user, ticketId);
  return prisma.$transaction(async (tx) => {
    await updateStatusTx(tx, req, user, current, "RESOLVED", input.summary, input.version);
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        resolutionSummary: input.summary,
        resolutionCode: input.code,
        rootCause: input.rootCause,
        correctiveAction: input.correctiveAction,
        preventiveAction: input.preventiveAction,
        publicExplanation: input.publicExplanation ?? input.summary,
      },
    });
    return loadDetail(ticketId, user.role, tx);
  });
}

export async function reopenTicket(req: Request, user: AuthenticatedUser, ticketId: string) {
  const current = await getAccessibleTicket(req, user, ticketId);
  if (user.role === "REQUESTER" && (current.requesterId !== user.id || current.status !== "RESOLVED")) throw forbidden();
  if (user.role !== "REQUESTER" && user.role !== "ADMIN" && user.role !== "TEAM_LEAD" && !canAssignTicket(user, current)) throw forbidden();
  return prisma.$transaction(async (tx) => {
    await updateStatusTx(tx, req, user, current, "IN_PROGRESS", "Ticket reopened by request.");
    await tx.ticket.update({ where: { id: ticketId }, data: { resolutionSummary: null, resolutionCode: null, rootCause: null, correctiveAction: null, preventiveAction: null, publicExplanation: null } });
    return loadDetail(ticketId, user.role, tx);
  });
}

export async function closeTicket(req: Request, user: AuthenticatedUser, ticketId: string, reason?: string) {
  requireStaff(user);
  const current = await getAccessibleTicket(req, user, ticketId);
  return prisma.$transaction(async (tx) => {
    await updateStatusTx(tx, req, user, current, "CLOSED", reason);
    return loadDetail(ticketId, user.role, tx);
  });
}

export async function updateTicketPriority(req: Request, user: AuthenticatedUser, ticketId: string, code: "LOW" | "NORMAL" | "HIGH" | "URGENT", reason?: string) {
  requireStaff(user);
  const current = await getAccessibleTicket(req, user, ticketId);
  const priority = await prisma.priority.findFirst({ where: { code, active: true } });
  if (!priority) throw notFound();
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const slaPolicy = await tx.slaPolicy.findUnique({ where: { priorityId: priority.id } });
    const responseDueAt = calculateDeadline(now, priority.firstResponseMinutes, slaPolicy);
    const resolutionDueAt = calculateDeadline(now, priority.resolutionMinutes, slaPolicy);
    const updated = await tx.ticket.updateMany({
      where: { id: ticketId, version: current.version, deletedAt: null },
      data: { priorityId: priority.id, dueAt: resolutionDueAt, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw conflict("STALE_TICKET", "This ticket changed. Reload it before saving.");
    await tx.slaTracking.upsert({
      where: { ticketId },
      create: { ticketId, firstResponseDueAt: responseDueAt, resolutionDueAt },
      update: { firstResponseDueAt: responseDueAt, resolutionDueAt, resolutionBreachedAt: null },
    });
    await writeAudit(tx, req, { actorId: user.id, action: "ticket.priority.changed", resourceType: "Ticket", resourceId: ticketId, beforeData: { priorityId: current.priorityId }, afterData: { priority: code, reason } });
    return loadDetail(ticketId, user.role, tx);
  });
}

async function findTeamId(tx: Prisma.TransactionClient, teamInput: string | undefined): Promise<string | null> {
  if (!teamInput) return null;
  const team = await tx.team.findFirst({ where: { OR: [{ id: teamInput }, { name: teamInput }], active: true } });
  if (!team) throw notFound();
  return team.id;
}

export async function assignTicket(req: Request, user: AuthenticatedUser, ticketId: string, input: AssignTicketInput) {
  const current = await getAccessibleTicket(req, user, ticketId);
  requireAssignableTicket(user, current);
  return prisma.$transaction(async (tx) => {
    const teamId = await findTeamId(tx, input.teamId);
    if (teamId && user.role !== "ADMIN" && !user.teamIds.includes(teamId)) throw forbidden();
    const agentId = input.agentId || null;
    let agent: { id: string; name: string; email: string; preferredLanguage: string; notificationPreference: { emailEnabled: boolean } | null } | null = null;
    if (agentId) {
      agent = await tx.user.findFirst({
        where: { id: agentId, active: true, deletedAt: null, role: { in: ["AGENT", "TEAM_LEAD", "ADMIN"] } },
        select: { id: true, name: true, email: true, preferredLanguage: true, notificationPreference: { select: { emailEnabled: true } } },
      });
      if (!agent) throw notFound();
      const membership = teamId ? await tx.teamMember.findFirst({ where: { teamId, userId: agent.id, active: true } }) : null;
      if (teamId && !membership && user.role !== "ADMIN") throw conflict("AGENT_NOT_IN_TEAM", "The selected agent is not a member of the selected team.");
    }

    const previousAssignments = await tx.ticketAssignment.findMany({ where: { ticketId, unassignedAt: null }, select: { id: true } });
    if (previousAssignments.length) {
      await tx.ticketAssignment.updateMany({ where: { id: { in: previousAssignments.map((item) => item.id) } }, data: { unassignedAt: new Date() } });
    }
    const updated = await tx.ticket.updateMany({ where: { id: ticketId, version: current.version }, data: { assignedTeamId: teamId, assignedAgentId: agentId, version: { increment: 1 } } });
    if (updated.count !== 1) throw conflict("STALE_TICKET", "This ticket changed. Reload it before assigning.");
    await tx.ticketAssignment.create({ data: { ticketId, assignedToUserId: agentId, assignedToTeamId: teamId, assignedById: user.id, reason: input.reason } });
    await writeAudit(tx, req, {
      actorId: user.id,
      action: "ticket.assigned",
      resourceType: "Ticket",
      resourceId: ticketId,
      beforeData: { assignedAgentId: current.assignedAgentId, assignedTeamId: current.assignedTeamId },
      afterData: { assignedAgentId: agentId, assignedTeamId: teamId, reason: input.reason },
    });

    const recipients = new Map<string, { email: string; locale: "en" | "am"; emailEnabled: boolean }>();
    if (agent) recipients.set(agent.id, { email: agent.email, locale: agent.preferredLanguage === "am" ? "am" : "en", emailEnabled: agent.notificationPreference?.emailEnabled ?? false });
    if (teamId) {
      const members = await tx.teamMember.findMany({ where: { teamId, active: true, user: { active: true, deletedAt: null } }, include: { user: { include: { notificationPreference: true } } } });
      for (const membership of members) recipients.set(membership.user.id, {
        email: membership.user.email,
        locale: membership.user.preferredLanguage === "am" ? "am" : "en",
        emailEnabled: membership.user.notificationPreference?.emailEnabled ?? false,
      });
    }
    for (const [recipientId, recipient] of recipients) {
      if (recipientId === user.id) continue;
      await createInAppNotification(tx, req, recipientId, ticketId, "assignment", ticketNotificationText(recipient.locale, "assigned"), `${current.ticketNumber} has been assigned to your team.`, recipient.email, recipient.emailEnabled, recipient.locale);
    }
    return loadDetail(ticketId, user.role, tx);
  });
}

export async function escalateTicket(req: Request, user: AuthenticatedUser, ticketId: string) {
  return updateTicketPriority(req, user, ticketId, "URGENT", "Escalated");
}

async function validateStagedAttachments(tx: Prisma.TransactionClient, userId: string, attachmentIds: string[], ticketId: string) {
  const ids = [...new Set(attachmentIds)];
  if (ids.length !== attachmentIds.length) throw conflict("DUPLICATE_ATTACHMENT", "An attachment was listed more than once.");
  if (!ids.length) return;
  const staged = await tx.attachment.findMany({
    where: { id: { in: ids }, uploadedById: userId, ticketId: null, commentId: null, deletedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (staged.length !== ids.length) throw notFound();
  await tx.attachment.updateMany({ where: { id: { in: ids } }, data: { ticketId, expiresAt: null } });
}

async function notifyCommentRecipients(
  tx: Prisma.TransactionClient,
  req: Request,
  user: AuthenticatedUser,
  ticket: Awaited<ReturnType<typeof getAccessibleTicket>>,
  visibility: "PUBLIC" | "INTERNAL"
) {
  let recipientIds: string[] = [];
  if (visibility === "PUBLIC") {
    if (user.role === "REQUESTER") {
      const teamMembers = ticket.assignedTeamId
        ? await tx.teamMember.findMany({ where: { teamId: ticket.assignedTeamId, active: true }, select: { userId: true } })
        : [];
      recipientIds = [ticket.assignedAgentId, ...teamMembers.map((item) => item.userId)].filter((id): id is string => Boolean(id));
    } else {
      recipientIds = [ticket.requesterId];
    }
  } else {
    const teamMembers = ticket.assignedTeamId
      ? await tx.teamMember.findMany({ where: { teamId: ticket.assignedTeamId, active: true }, select: { userId: true } })
      : [];
    recipientIds = [ticket.assignedAgentId, ...teamMembers.map((item) => item.userId)].filter((id): id is string => Boolean(id));
  }

  const ids = [...new Set(recipientIds)].filter((id) => id !== user.id);
  if (!ids.length) return;
  const recipients = await tx.user.findMany({ where: { id: { in: ids }, active: true }, include: { notificationPreference: true } });
  for (const recipient of recipients) {
    const locale = recipient.preferredLanguage === "am" ? "am" : "en";
    const title = ticketNotificationText(locale, "reply");
    await createInAppNotification(
      tx, req, recipient.id, ticket.id, visibility === "INTERNAL" ? "internal_note" : "reply",
      title,
      visibility === "INTERNAL" ? `${ticket.ticketNumber}: A staff note was added.` : `${ticket.ticketNumber}: ${title}`,
      recipient.email,
      recipient.notificationPreference?.emailEnabled ?? false,
      locale
    );
  }
}

export async function addComment(
  req: Request,
  user: AuthenticatedUser,
  ticketId: string,
  input: CommentInput,
  visibility: "PUBLIC" | "INTERNAL"
): Promise<{ id: string }> {
  const current = await getAccessibleTicket(req, user, ticketId);
  if (visibility === "INTERNAL") requireStaff(user);
  if (current.status === "CLOSED") throw conflict("TICKET_CLOSED", "Closed tickets cannot receive new comments.");
  if (user.role === "REQUESTER" && current.requesterId !== user.id) throw notFound();

  return prisma.$transaction(async (tx) => {
    const comment = await tx.ticketComment.create({ data: { ticketId, authorId: user.id, body: input.body, visibility } });
    await validateStagedAttachments(tx, user.id, input.attachmentIds, ticketId);
    if (input.attachmentIds.length) {
      await tx.attachment.updateMany({ where: { id: { in: input.attachmentIds } }, data: { commentId: comment.id } });
    }
    const ticketChanges: Prisma.TicketUpdateManyMutationInput = { version: { increment: 1 } };
    if (user.role !== "REQUESTER" && !current.firstResponseAt) {
      ticketChanges.firstResponseAt = new Date();
      await tx.slaTracking.updateMany({ where: { ticketId, firstResponseBreachedAt: null }, data: { firstResponseDueAt: null } });
    }
    await tx.ticket.update({ where: { id: ticketId }, data: ticketChanges });
    await writeAudit(tx, req, {
      actorId: user.id,
      action: visibility === "INTERNAL" ? "ticket.internal-note.created" : "ticket.reply.created",
      resourceType: "Ticket",
      resourceId: ticketId,
      afterData: { commentId: comment.id, visibility },
    });
    await notifyCommentRecipients(tx, req, user, current, visibility);
    return { id: comment.id };
  });
}

export async function listComments(req: Request, user: AuthenticatedUser, ticketId: string) {
  await getAccessibleTicket(req, user, ticketId);
  const where: Prisma.TicketCommentWhereInput = {
    ticketId,
    deletedAt: null,
    ...(user.role === "REQUESTER" ? { visibility: "PUBLIC" } : {}),
  };
  const items = await prisma.ticketComment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, role: true } },
      attachments: { where: { deletedAt: null }, select: { id: true, originalName: true, sizeBytes: true, mimeType: true, createdAt: true } },
    },
  });
  return {
    items: items.map((comment) => ({
      id: comment.id,
      authorId: comment.authorId,
      authorName: comment.author.name,
      authorRole: comment.author.role,
      body: comment.body,
      isInternal: comment.visibility === "INTERNAL",
      createdAt: comment.createdAt.toISOString(),
      attachments: comment.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.originalName,
        fileSize: Number(attachment.sizeBytes),
        mimeType: attachment.mimeType,
        createdAt: attachment.createdAt.toISOString(),
      })),
    })),
    total: items.length,
  };
}

export async function updateComment(req: Request, user: AuthenticatedUser, commentId: string, input: UpdateCommentInput) {
  const comment = await prisma.ticketComment.findFirst({ where: { id: commentId, deletedAt: null }, include: { ticket: true } });
  if (!comment || !canViewTicket(user, comment.ticket)) throw notFound();
  if (comment.authorId !== user.id && user.role !== "ADMIN") throw forbidden();
  if (comment.visibility === "INTERNAL" && user.role === "REQUESTER") throw notFound();
  const updated = await prisma.ticketComment.update({ where: { id: commentId }, data: { body: input.body } });
  await writeAudit(prisma, req, { actorId: user.id, action: "ticket.comment.updated", resourceType: "TicketComment", resourceId: commentId });
  return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
}

export async function deleteComment(req: Request, user: AuthenticatedUser, commentId: string): Promise<void> {
  const comment = await prisma.ticketComment.findFirst({ where: { id: commentId, deletedAt: null }, include: { ticket: true } });
  if (!comment || !canViewTicket(user, comment.ticket)) throw notFound();
  if (comment.authorId !== user.id && user.role !== "ADMIN") throw forbidden();
  await prisma.ticketComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  await writeAudit(prisma, req, { actorId: user.id, action: "ticket.comment.deleted", resourceType: "TicketComment", resourceId: commentId });
}

export async function ticketHistory(req: Request, user: AuthenticatedUser, ticketId: string) {
  await getAccessibleTicket(req, user, ticketId);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: ticketDetailInclude });
  if (!ticket) throw notFound();
  return toTicketDetailDto(ticket, user.role).history;
}

export async function ticketSla(req: Request, user: AuthenticatedUser, ticketId: string) {
  const ticket = await getAccessibleTicket(req, user, ticketId);
  const tracking = await prisma.slaTracking.findUnique({ where: { ticketId } });
  if (!tracking) return { ticketId, state: "NOT_APPLICABLE", firstResponseDueAt: null, resolutionDueAt: null, firstResponseBreachedAt: null, resolutionBreachedAt: null };
  const now = Date.now();
  const state = ticket.status === "RESOLVED" ? "COMPLETED" : ticket.status === "CLOSED" ? "NOT_APPLICABLE" : tracking.resolutionBreachedAt || (tracking.resolutionDueAt && tracking.resolutionDueAt.getTime() < now) ? "BREACHED" : tracking.resolutionDueAt && tracking.resolutionDueAt.getTime() - now <= 3600000 ? "AT_RISK" : "ON_TRACK";
  return {
    ticketId,
    state,
    firstResponseDueAt: tracking.firstResponseDueAt?.toISOString() ?? null,
    resolutionDueAt: tracking.resolutionDueAt?.toISOString() ?? null,
    firstResponseBreachedAt: tracking.firstResponseBreachedAt?.toISOString() ?? null,
    resolutionBreachedAt: tracking.resolutionBreachedAt?.toISOString() ?? null,
  };
}

