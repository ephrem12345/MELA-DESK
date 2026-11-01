import { Router } from "express";
import { prisma } from "../../config/database.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { ticketScopeWhere } from "../tickets/service.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuthentication);

dashboardRouter.get("/stats", async (req, res) => {
  const scope = ticketScopeWhere(req.authUser!);
  const base = { deletedAt: null, ...scope };
  const [total, open, inProgress, pending, resolved, urgent] = await Promise.all([
    prisma.ticket.count({ where: base }),
    prisma.ticket.count({ where: { ...base, status: "OPEN" } }),
    prisma.ticket.count({ where: { ...base, status: "IN_PROGRESS" } }),
    prisma.ticket.count({ where: { ...base, status: { in: ["PENDING_REQUESTER", "PENDING_THIRD_PARTY"] } } }),
    prisma.ticket.count({ where: { ...base, status: { in: ["RESOLVED", "CLOSED"] } } }),
    prisma.ticket.count({ where: { ...base, priority: { code: "URGENT" } } }),
  ]);
  res.json({ total, open, inProgress, pending, resolved, urgent });
});
