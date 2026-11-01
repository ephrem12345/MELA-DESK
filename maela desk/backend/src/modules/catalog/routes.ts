import { Router } from "express";
import { prisma } from "../../config/database.js";
import { notFound } from "../../errors/app-error.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { requireAdministrator } from "../../middleware/authorize.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { writeAudit } from "../../services/audit.js";
import { categoryCreateSchema, categoryUpdateSchema, catalogIdParams, priorityCreateSchema, priorityUpdateSchema } from "./schemas.js";
import type { z } from "zod";

export const catalogRouter = Router();

catalogRouter.get("/categories", async (_req, res) => {
  const items = await prisma.category.findMany({ where: { active: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  res.json(items.map((item) => ({ id: item.id, name: item.name, labelEn: item.labelEn, labelAm: item.labelAm, description: item.description, parentId: item.parentId, active: item.active, displayOrder: item.displayOrder })));
});

catalogRouter.post("/categories", requireAuthentication, requireAdministrator, validateBody(categoryCreateSchema), async (req, res) => {
  const category = await prisma.category.create({ data: req.body as z.infer<typeof categoryCreateSchema> });
  await writeAudit(prisma, req, { actorId: req.authUser?.id, action: "category.created", resourceType: "Category", resourceId: category.id, afterData: { name: category.name } });
  res.status(201).json({ category });
});

catalogRouter.patch("/categories/:id", requireAuthentication, requireAdministrator, validateParams(catalogIdParams), validateBody(categoryUpdateSchema), async (req, res) => {
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound();
  const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body as z.infer<typeof categoryUpdateSchema> });
  await writeAudit(prisma, req, { actorId: req.authUser?.id, action: "category.updated", resourceType: "Category", resourceId: category.id, beforeData: { name: before.name }, afterData: req.body });
  res.json({ category });
});

catalogRouter.get("/priorities", async (_req, res) => {
  const items = await prisma.priority.findMany({ where: { active: true }, orderBy: { level: "asc" } });
  res.json(items.map((item) => ({ id: item.id, code: item.code, name: item.name, level: item.level, firstResponseMinutes: item.firstResponseMinutes, resolutionMinutes: item.resolutionMinutes, active: item.active })));
});

catalogRouter.post("/priorities", requireAuthentication, requireAdministrator, validateBody(priorityCreateSchema), async (req, res) => {
  const priority = await prisma.priority.create({ data: req.body as z.infer<typeof priorityCreateSchema> });
  await prisma.slaPolicy.create({ data: { priorityId: priority.id } });
  await writeAudit(prisma, req, { actorId: req.authUser?.id, action: "priority.created", resourceType: "Priority", resourceId: priority.id, afterData: { code: priority.code, level: priority.level } });
  res.status(201).json({ priority });
});

catalogRouter.patch("/priorities/:id", requireAuthentication, requireAdministrator, validateParams(catalogIdParams), validateBody(priorityUpdateSchema), async (req, res) => {
  const before = await prisma.priority.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound();
  const priority = await prisma.priority.update({ where: { id: req.params.id }, data: req.body as z.infer<typeof priorityUpdateSchema> });
  await writeAudit(prisma, req, { actorId: req.authUser?.id, action: "priority.updated", resourceType: "Priority", resourceId: priority.id, beforeData: { code: before.code, level: before.level }, afterData: req.body });
  res.json({ priority });
});
