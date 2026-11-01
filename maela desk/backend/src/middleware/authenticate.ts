import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { unauthorized } from "../errors/app-error.js";

export const optionalAuthentication: RequestHandler = async (req, _res, next) => {
  try {
    const rawToken = req.cookies?.[env.SESSION_COOKIE_NAME];
    if (!rawToken || typeof rawToken !== "string") return next();
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { teamMemberships: { where: { active: true }, select: { teamId: true } } } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.active || session.user.deletedAt) return next();
    req.authUser = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      departmentId: session.user.departmentId,
      teamIds: session.user.teamMemberships.map((membership) => membership.teamId),
      locale: session.user.preferredLanguage === "am" ? "am" : "en",
    };
    const staleAfter = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastUsedAt < staleAfter) {
      void prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuthentication: RequestHandler = (req, _res, next) => {
  if (!req.authUser) return next(unauthorized());
  next();
};
