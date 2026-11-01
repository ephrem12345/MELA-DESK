import type { Request } from "express";
import type { TicketStatus } from "../../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import { writeAudit } from "./audit.js";
import { DEFAULT_TRANSITIONS, parseWorkflowTransitions } from "../policies/tickets.js";

export async function getWorkflowTransitions() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "ticket.workflow" } });
  return setting ? parseWorkflowTransitions(setting.value) : DEFAULT_TRANSITIONS;
}

export async function saveWorkflowTransitions(req: Request, value: Record<TicketStatus, TicketStatus[]>) {
  const safe: Record<TicketStatus, TicketStatus[]> = {
    OPEN: value.OPEN.filter((status) => DEFAULT_TRANSITIONS.OPEN.includes(status)),
    IN_PROGRESS: value.IN_PROGRESS.filter((status) => DEFAULT_TRANSITIONS.IN_PROGRESS.includes(status)),
    PENDING_REQUESTER: value.PENDING_REQUESTER.filter((status) => DEFAULT_TRANSITIONS.PENDING_REQUESTER.includes(status)),
    PENDING_THIRD_PARTY: value.PENDING_THIRD_PARTY.filter((status) => DEFAULT_TRANSITIONS.PENDING_THIRD_PARTY.includes(status)),
    RESOLVED: value.RESOLVED.filter((status) => DEFAULT_TRANSITIONS.RESOLVED.includes(status)),
    CLOSED: value.CLOSED.filter((status) => DEFAULT_TRANSITIONS.CLOSED.includes(status)),
  };
  const before = await getWorkflowTransitions();
  await prisma.systemSetting.upsert({
    where: { key: "ticket.workflow" },
    create: { key: "ticket.workflow", value: safe as never, updatedBy: req.authUser?.id },
    update: { value: safe as never, updatedBy: req.authUser?.id },
  });
  await writeAudit(prisma, req, { actorId: req.authUser?.id, action: "workflow.updated", resourceType: "Workflow", resourceId: "ticket", beforeData: before, afterData: safe });
  return safe;
}
