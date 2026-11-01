import { Router } from "express";
import { prisma } from "../../config/database.js";
import { notFound } from "../../errors/app-error.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { requireAdministrator } from "../../middleware/authorize.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { writeAudit } from "../../services/audit.js";
import { departmentCreateSchema, departmentIdParams, departmentQuery, departmentUpdateSchema } from "./schemas.js";
import type { z } from "zod";

export const departmentRouter = Router();
departmentRouter.use(requireAuthentication);

function dto(department: { id: string; name: string; code: string; description: string | null; active: boolean; createdAt: Date; updatedAt: Date; _count?: { users: number; teams: number } }) {
  return { ...department, createdAt: department.createdAt.toISOString(), updatedAt: department.updatedAt.toISOString(), userCount: department._count?.users ?? 0, teamCount: department._count?.teams ?? 0 };
}

departmentRouter.get("/", validateQuery(departmentQuery), async (req, res) => {
  if (!req.authUser || !["ADMIN", "TEAM_LEAD"].includes(req.authUser.role)) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You do not have permission to view departments." } });
  const filters = req.validatedQuery as z.infer<typeof departmentQuery>;
  const departments = await prisma.department.findMany({
    where: { ...(filters.active ? { active: filters.active === "true" } : {}), ...(filters.q ? { name: { contains: filters.q } } : {}) },
    include: { _count: { select: { users: true, teams: true } } },
    orderBy: { name: "asc" },
    take: 100,
  });
  res.json({ items: departments.map(dto), total: departments.length });
});

departmentRouter.post("/", requireAdministrator, validateBody(departmentCreateSchema), async (req, res) => {
  const data = req.body as z.infer<typeof departmentCreateSchema>;
  const department = await prisma.department.create({ data });
  await writeAudit(prisma, req, { actorId: req.authUser?.id, action: "department.created", resourceType: "Department", resourceId: department.id, afterData: { name: department.name, code: department.code } });
  res.status(201).json({ department: dto(department) });
});

departmentRouter.get("/:id", validateParams(departmentIdParams), async (req, res) => {
  if (req.authUser?.role !== "ADMIN" && req.authUser?.role !== "TEAM_LEAD") return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You do not have permission to view departments." } });
  const department = await prisma.department.findUnique({ where: { id: req.params.id }, include: { _count: { select: { users: true, teams: true } } } });
  if (!department) throw notFound();
  res.json({ department: dto(department) });
});

departmentRouter.patch("/:id", requireAdministrator, validateParams(departmentIdParams), validateBody(departmentUpdateSchema), async (req, res) => {
  const before = await prisma.department.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound();
  const department = await prisma.department.update({ where: { id: req.params.id }, data: req.body as z.infer<typeof departmentUpdateSchema> });
  await writeAudit(prisma, req, { actorId: req.authUser?.id, action: "department.updated", resourceType: "Department", resourceId: department.id, beforeData: { name: before.name, code: before.code }, afterData: req.body });
  res.json({ department: dto(department) });
});
