import type { Prisma, TicketStatus } from "../../generated/prisma/client.js";
import type { AuthenticatedUser } from "../types/express.js";
import { conflict, forbidden, notFound } from "../errors/app-error.js";
import { z } from "zod";

type TicketAccessRecord = {
  id: string;
  requesterId: string;
  assignedAgentId: string | null;
  assignedTeamId: string | null;
  departmentId: string | null;
  deletedAt: Date | null;
};

export function canViewTicket(user: AuthenticatedUser, ticket: TicketAccessRecord): boolean {
  if (ticket.deletedAt) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "REQUESTER") return ticket.requesterId === user.id;
  if (ticket.assignedAgentId === user.id) return true;
  if (ticket.assignedTeamId && user.teamIds.includes(ticket.assignedTeamId)) return true;
  if (user.role === "TEAM_LEAD" && ticket.departmentId && ticket.departmentId === user.departmentId) return true;
  return false;
}

export async function requireTicketAccess(
  db: Pick<Prisma.TransactionClient, "ticket"> | Prisma.TransactionClient,
  user: AuthenticatedUser,
  ticketId: string
) {
  const ticket = await db.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
  if (!ticket || !canViewTicket(user, ticket)) throw notFound();
  return ticket;
}

export function canAssignTicket(user: AuthenticatedUser, ticket: TicketAccessRecord): boolean {
  if (user.role === "ADMIN" || user.role === "TEAM_LEAD") return canViewTicket(user, ticket) || !ticket.assignedTeamId;
  return user.role === "AGENT" && canViewTicket(user, ticket);
}

export function requireAssignableTicket(user: AuthenticatedUser, ticket: TicketAccessRecord): void {
  if (!canAssignTicket(user, ticket)) throw forbidden();
}

export const DEFAULT_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "CLOSED"],
  IN_PROGRESS: ["PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"],
  PENDING_REQUESTER: ["IN_PROGRESS", "CLOSED"],
  PENDING_THIRD_PARTY: ["IN_PROGRESS", "CLOSED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["OPEN"],
};

export function parseWorkflowTransitions(value: unknown): Record<TicketStatus, TicketStatus[]> {
  const status = z.enum(["OPEN", "IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"]);
  const schema = z.object({
    OPEN: z.array(status),
    IN_PROGRESS: z.array(status),
    PENDING_REQUESTER: z.array(status),
    PENDING_THIRD_PARTY: z.array(status),
    RESOLVED: z.array(status),
    CLOSED: z.array(status),
  }).strict();
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data as Record<TicketStatus, TicketStatus[]> : DEFAULT_TRANSITIONS;
}

export function assertStatusTransition(from: TicketStatus, to: TicketStatus, actor: AuthenticatedUser, transitions = DEFAULT_TRANSITIONS): void {
  if (from === to) return;
  if (!DEFAULT_TRANSITIONS[from].includes(to) || !transitions[from].includes(to)) throw conflict("INVALID_STATUS_TRANSITION", "That status transition is not allowed.");
  if (to === "OPEN" && from === "CLOSED" && actor.role !== "ADMIN" && actor.role !== "TEAM_LEAD") throw forbidden();
}

export function visibleCommentWhere(user: AuthenticatedUser) {
  return user.role === "REQUESTER" ? { visibility: "PUBLIC" as const, deletedAt: null } : { deletedAt: null };
}
