import { Router } from "express";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { requireAdministrator } from "../../middleware/authorize.js";
import { getWorkflowTransitions, saveWorkflowTransitions } from "../../services/workflow.js";
import { z } from "zod";

export const adminRouter = Router();
adminRouter.use(["/roles", "/workflows"], requireAuthentication, requireAdministrator);

adminRouter.get("/roles", (_req, res) => {
  res.json({ items: [
    { role: "REQUESTER", permissions: ["ticket.create.own", "ticket.read.own", "comment.reply.own", "notification.read.own"] },
    { role: "AGENT", permissions: ["ticket.read.assigned", "ticket.update.assigned", "comment.reply", "comment.internal", "ticket.assign.team"] },
    { role: "TEAM_LEAD", permissions: ["ticket.read.team", "ticket.assign.team", "ticket.resolve.team", "report.read.team", "team.members.manage"] },
    { role: "ADMIN", permissions: ["user.manage", "team.manage", "department.manage", "category.manage", "priority.manage", "sla.manage", "audit.read", "report.read.all", "settings.manage"] },
  ] });
});

const statuses = z.enum(["OPEN", "IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"]);
const workflowSchema = z.object({
  transitions: z.object({
    OPEN: z.array(statuses),
    IN_PROGRESS: z.array(statuses),
    PENDING_REQUESTER: z.array(statuses),
    PENDING_THIRD_PARTY: z.array(statuses),
    RESOLVED: z.array(statuses),
    CLOSED: z.array(statuses),
  }).strict(),
}).strict();

adminRouter.get("/workflows", async (_req, res) => {
  res.json({ initialStatus: "OPEN", transitions: await getWorkflowTransitions() });
});

adminRouter.patch("/workflows", async (req, res) => {
  const body = workflowSchema.parse(req.body);
  res.json({ initialStatus: "OPEN", transitions: await saveWorkflowTransitions(req, body.transitions) });
});
