import { Router } from "express";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { notFound } from "../../errors/app-error.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { requireAdministrator } from "../../middleware/authorize.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { writeAudit } from "../../services/audit.js";
import { z } from "zod";

const idParams = z.object({ id: z.string().uuid() }).strict();
const policySchema = z.object({
  warningMinutes: z.coerce.number().int().min(1).max(10080).optional(),
  businessHoursEnabled: z.boolean().optional(),
  businessHours: z.record(z.string(), z.unknown()).nullable().optional(),
  holidays: z.array(z.string().date()).nullable().optional(),
  pauseWhenPending: z.boolean().optional(),
  escalationRules: z.array(z.object({ afterMinutes: z.number().int().positive(), role: z.enum(["AGENT", "TEAM_LEAD", "ADMIN"]) }).strict()).nullable().optional(),
  active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one policy field must be updated." });

export const slaRouter = Router();
slaRouter.use(requireAuthentication, requireAdministrator);

slaRouter.get("/", async (_req, res) => {
  const policies = await prisma.slaPolicy.findMany({ include: { priority: true }, orderBy: { priority: { level: "asc" } } });
  res.json({ items: policies.map((policy) => ({
    id: policy.id,
    priorityId: policy.priorityId,
    priority: policy.priority.code,
    priorityName: policy.priority.name,
    firstResponseMinutes: policy.priority.firstResponseMinutes,
    resolutionMinutes: policy.priority.resolutionMinutes,
    warningMinutes: policy.warningMinutes,
    businessHoursEnabled: policy.businessHoursEnabled,
    businessHours: policy.businessHours,
    holidays: policy.holidays,
    pauseWhenPending: policy.pauseWhenPending,
    escalationRules: policy.escalationRules,
    active: policy.active,
  })), total: policies.length });
});

slaRouter.patch("/:id", validateParams(idParams), validateBody(policySchema), async (req, res) => {
  const before = await prisma.slaPolicy.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound();
  const body = req.body as z.infer<typeof policySchema>;
  const jsonField = (value: unknown) =>
    value === undefined ? undefined : value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
  const policy = await prisma.slaPolicy.update({
    where: { id: before.id },
    data: {
      warningMinutes: body.warningMinutes,
      businessHoursEnabled: body.businessHoursEnabled,
      businessHours: jsonField(body.businessHours),
      holidays: jsonField(body.holidays),
      pauseWhenPending: body.pauseWhenPending,
      escalationRules: jsonField(body.escalationRules),
      active: body.active,
    },
  });
  await writeAudit(prisma, req, { actorId: req.authUser?.id, action: "sla.policy.updated", resourceType: "SlaPolicy", resourceId: policy.id, beforeData: { warningMinutes: before.warningMinutes, pauseWhenPending: before.pauseWhenPending }, afterData: req.body });
  res.json({ id: policy.id, priorityId: policy.priorityId, warningMinutes: policy.warningMinutes, businessHoursEnabled: policy.businessHoursEnabled, businessHours: policy.businessHours, holidays: policy.holidays, pauseWhenPending: policy.pauseWhenPending, escalationRules: policy.escalationRules, active: policy.active });
});
