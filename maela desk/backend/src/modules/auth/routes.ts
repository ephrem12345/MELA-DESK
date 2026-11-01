import { Router } from "express";
import { prisma } from "../../config/database.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { csrfBootstrap } from "../../middleware/csrf.js";
import { loginRateLimit, passwordResetRateLimit, registrationRateLimit } from "../../middleware/rate-limit.js";
import { validateBody } from "../../middleware/validate.js";
import { resolveLocale } from "../../services/localization.js";
import { badRequest } from "../../errors/app-error.js";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./schemas.js";
import { changePassword, login, logout, register, requestPasswordReset, resetPassword } from "./service.js";

export const authRouter = Router();

authRouter.get("/csrf", csrfBootstrap());
authRouter.post("/register", registrationRateLimit, validateBody(registerSchema), async (req, res) => {
  res.status(201).json(await register(req, res));
});
authRouter.post("/login", loginRateLimit, validateBody(loginSchema), async (req, res) => {
  res.status(200).json(await login(req, res));
});
authRouter.post("/logout", async (req, res) => {
  await logout(req, res);
  res.status(204).end();
});
authRouter.get("/me", requireAuthentication, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.authUser!.id },
    include: { teamMemberships: { where: { active: true }, include: { team: true }, take: 1 } },
  });
  if (!user) throw badRequest("USER_NOT_FOUND", "The user account is unavailable.");
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.teamMemberships[0]?.team.id ?? null,
      teamName: user.teamMemberships[0]?.team.name ?? null,
      preferredLanguage: user.preferredLanguage === "am" ? "am" : "en",
      timeZone: user.timeZone,
      createdAt: user.createdAt.toISOString(),
      active: user.active,
    },
  });
});
authRouter.post("/change-password", requireAuthentication, validateBody(changePasswordSchema), async (req, res) => {
  await changePassword(req, req.authUser!);
  res.status(204).end();
});
authRouter.post("/forgot-password", passwordResetRateLimit, validateBody(forgotPasswordSchema), async (req, res) => {
  await requestPasswordReset(req);
  res.status(202).json({ accepted: true, locale: resolveLocale(req) });
});
authRouter.post("/reset-password", passwordResetRateLimit, validateBody(resetPasswordSchema), async (req, res) => {
  await resetPassword(req);
  res.status(204).end();
});
