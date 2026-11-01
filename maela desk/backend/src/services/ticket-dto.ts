import type { Prisma } from "../../generated/prisma/client.js";
import type { Role } from "../../generated/prisma/client.js";

export const ticketListInclude = {
  requester: { select: { id: true, name: true, email: true } },
  assignedAgent: { select: { id: true, name: true } },
  assignedTeam: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, labelEn: true, labelAm: true, description: true, parentId: true, active: true, displayOrder: true } },
  priority: { select: { code: true } },
  attachments: { where: { deletedAt: null }, select: { id: true } },
  slaTracking: { select: { resolutionDueAt: true, firstResponseDueAt: true, resolutionBreachedAt: true } },
} satisfies Prisma.TicketInclude;

export const ticketDetailInclude = {
  ...ticketListInclude,
  requester: { select: { id: true, name: true, email: true } },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, role: true } },
      attachments: { where: { deletedAt: null }, select: { id: true, originalName: true, sizeBytes: true, mimeType: true, createdAt: true } },
    },
  },
  statusHistory: {
    orderBy: { createdAt: "asc" },
    include: { changedBy: { select: { name: true } } },
  },
  assignments: {
    orderBy: { assignedAt: "asc" },
    include: {
      assignedBy: { select: { name: true } },
      assignedTo: { select: { id: true, name: true } },
      assignedTeam: { select: { id: true, name: true } },
    },
  },
  attachments: {
    where: { deletedAt: null },
    select: { id: true, originalName: true, sizeBytes: true, mimeType: true, createdAt: true },
  },
} satisfies Prisma.TicketInclude;

export type TicketListRecord = Prisma.TicketGetPayload<{ include: typeof ticketListInclude }>;
export type TicketDetailRecord = Prisma.TicketGetPayload<{ include: typeof ticketDetailInclude }>;

function slaIndicator(ticket: Pick<TicketListRecord, "status" | "slaTracking">): string {
  if (ticket.status === "RESOLVED") return "COMPLETED";
  if (ticket.status === "CLOSED") return "NOT_APPLICABLE";
  const dueAt = ticket.slaTracking?.resolutionDueAt;
  if (ticket.slaTracking?.resolutionBreachedAt || (dueAt && dueAt.getTime() < Date.now())) return "BREACHED";
  if (dueAt && dueAt.getTime() - Date.now() <= 60 * 60 * 1000) return "AT_RISK";
  return "ON_TRACK";
}

export function toTicketDto(ticket: TicketListRecord) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority.code,
    category: ticket.category,
    requester: ticket.requester,
    assignedTeam: ticket.assignedTeam?.name ?? null,
    assignedAgent: ticket.assignedAgent,
    slaDueAt: ticket.slaTracking?.resolutionDueAt?.toISOString() ?? ticket.dueAt?.toISOString() ?? null,
    slaIndicator: slaIndicator(ticket),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    attachmentCount: ticket.attachments.length,
  };
}

export function toTicketDetailDto(ticket: TicketDetailRecord, viewerRole: Role) {
  const base = toTicketDto(ticket);
  const comments = viewerRole === "REQUESTER"
    ? ticket.comments.filter((comment) => comment.visibility === "PUBLIC")
    : ticket.comments;
  const messages = comments.map((comment) => ({
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
  }));
  const history = [
    ...ticket.statusHistory.map((item) => ({
      id: item.id,
      field: "status",
      fromValue: item.previousStatus,
      toValue: item.newStatus,
      actorName: item.changedBy?.name ?? "System",
      createdAt: item.createdAt.toISOString(),
    })),
    ...ticket.assignments.map((item) => ({
      id: item.id,
      field: "assignee",
      fromValue: null,
      toValue: item.assignedTo?.name ?? item.assignedTeam?.name ?? null,
      actorName: item.assignedBy?.name ?? "System",
      createdAt: item.assignedAt.toISOString(),
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const attachments = ticket.attachments.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.originalName,
    fileSize: Number(attachment.sizeBytes),
    mimeType: attachment.mimeType,
    createdAt: attachment.createdAt.toISOString(),
  }));
  const hasResolution = ticket.resolutionSummary || ticket.resolutionCode || ticket.resolvedAt;

  return {
    ...base,
    requesterEmail: ticket.requester.email,
    messages,
    history,
    attachments,
    resolution: hasResolution ? {
      summary: ticket.resolutionSummary,
      code: ticket.resolutionCode,
      rootCause: ticket.rootCause,
      correctiveAction: ticket.correctiveAction,
      preventiveAction: ticket.preventiveAction,
      publicExplanation: ticket.publicExplanation,
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    } : null,
    relatedTicketNumbers: [],
  };
}
