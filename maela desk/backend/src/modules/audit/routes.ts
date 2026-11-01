import { Router } from "express";
import { prisma } from "../../config/database.js";
import { forbidden, notFound } from "../../errors/app-error.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { validateParams, validateQuery } from "../../middleware/validate.js";
import { z } from "zod";

const logParams = z.object({ id: z.string().uuid() }).strict();
const logsQuery = z.object({
  q: z.string().trim().max(160).optional(),
  action: z.string().trim().max(100).optional(),
  resourceType: z.string().trim().max(80).optional(),
  resourceId: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const auditRouter = Router();
auditRouter.use(requireAuthentication, (req, _res, next) => req.authUser?.role === "ADMIN" ? next() : next(forbidden()));

auditRouter.get("/", validateQuery(logsQuery), async (req, res) => {
  const filters = req.validatedQuery as z.infer<typeof logsQuery>;
  const where = {
    ...(filters.action ? { action: { contains: filters.action } } : {}),
    ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
    ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
    ...(filters.q ? { OR: [{ action: { contains: filters.q } }, { resourceType: { contains: filters.q } }, { resourceId: { contains: filters.q } }] } : {}),
  };
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ where, include: { actor: { select: { email: true, name: true } } }, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({
    items: logs.map((item) => ({
      id: item.id,
      timestamp: item.createdAt.toISOString(),
      actor: item.actor?.email ?? "system",
      actorName: item.actor?.name ?? "System",
      action: item.action,
      resourceType: item.resourceType,
      resourceId: item.resourceId ?? "",
      changes: item.beforeData || item.afterData ? JSON.stringify({ before: item.beforeData, after: item.afterData }) : null,
      correlationId: item.requestId,
      outcome: item.outcome,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  });
});

auditRouter.get("/:id", validateParams(logParams), async (req, res) => {
  const item = await prisma.auditLog.findUnique({ where: { id: req.params.id }, include: { actor: { select: { email: true, name: true } } } });
  if (!item) throw notFound();
  res.json({
    id: item.id,
    timestamp: item.createdAt.toISOString(),
    actor: item.actor?.email ?? "system",
    actorName: item.actor?.name ?? "System",
    action: item.action,
    resourceType: item.resourceType,
    resourceId: item.resourceId,
    requestId: item.requestId,
    beforeData: item.beforeData,
    afterData: item.afterData,
    outcome: item.outcome,
  });
});
