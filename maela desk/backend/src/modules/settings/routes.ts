import { Router } from "express";
import { prisma } from "../../config/database.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { requireAdministrator } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { writeAudit } from "../../services/audit.js";
import { z } from "zod";

const updateSettingsSchema = z.object({ settings: z.record(z.string().regex(/^[a-zA-Z0-9._-]{1,120}$/), z.unknown()).refine((settings) => Object.keys(settings).length > 0 && Object.keys(settings).length <= 50) }).strict();
const secretKeys = /secret|password|token|credential|smtp|database/i;

export const settingsRouter = Router();
settingsRouter.use(requireAuthentication, requireAdministrator);

settingsRouter.get("/", async (_req, res) => {
  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  res.json({ items: settings.filter((item) => !secretKeys.test(item.key)).map((item) => ({ key: item.key, value: item.value, updatedAt: item.updatedAt.toISOString() })) });
});

settingsRouter.patch("/", validateBody(updateSettingsSchema), async (req, res) => {
  const { settings } = req.body as z.infer<typeof updateSettingsSchema>;
  if (Object.keys(settings).some((key) => secretKeys.test(key))) {
    return res.status(422).json({ success: false, error: { code: "PROTECTED_SETTING", message: "Secret settings must be configured through environment variables.", requestId: req.requestId } });
  }
  const before = await prisma.systemSetting.findMany({ where: { key: { in: Object.keys(settings) } } });
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(settings)) {
      await tx.systemSetting.upsert({ where: { key }, create: { key, value: value as never, updatedBy: req.authUser!.id }, update: { value: value as never, updatedBy: req.authUser!.id } });
    }
    await writeAudit(tx, req, { actorId: req.authUser!.id, action: "settings.updated", resourceType: "SystemSettings", resourceId: "global", beforeData: Object.fromEntries(before.map((item) => [item.key, item.value])), afterData: settings });
  });
  res.json({ updated: Object.keys(settings) });
});
