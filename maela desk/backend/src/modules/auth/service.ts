import { randomUUID } from "node:crypto";
import { Algorithm, hash, verify } from "@node-rs/argon2";
import type { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { conflict, unauthorized } from "../../errors/app-error.js";
import { writeAudit } from "../../services/audit.js";
import { createToken, encryptSecret, hashToken } from "../../services/crypto.js";
import { resolveLocale } from "../../services/localization.js";
import { enqueueOutbox } from "../../services/outbox.js";
import { csrfCookieOptions } from "../../middleware/csrf.js";
import type { AuthenticatedUser } from "../../types/express.js";

const argonOptions = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };
let dummyHashPromise: Promise<string> | null = null;

function toUserDto(user: {
  id: string;
  name: string;
  email: string;
  role: AuthenticatedUser["role"];
  departmentId: string | null;
  createdAt: Date;
  active: boolean;
  preferredLanguage: string;
  timeZone: string;
  teamMemberships?: { team: { id: string; name: string } }[];
}) {
  const membership = user.teamMemberships?.[0]?.team;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: membership?.id ?? null,
    teamName: membership?.name ?? null,
    departmentId: user.departmentId,
    locale: user.preferredLanguage === "am" ? "am" : "en",
    preferredLanguage: user.preferredLanguage === "am" ? "am" : "en",
    timeZone: user.timeZone,
    createdAt: user.createdAt.toISOString(),
    active: user.active,
  };
}

function setSessionCookie(res: Response, rawToken: string): void {
  res.cookie(env.SESSION_COOKIE_NAME, rawToken, {
    ...csrfCookieOptions(true),
    maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, csrfCookieOptions(true));
}

async function newSession(req: Request, res: Response, userId: string): Promise<void> {
  const raw = createToken(48);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt,
      lastUsedAt: now,
      ipAddress: req.ip?.slice(0, 64),
      userAgent: req.get("user-agent")?.slice(0, 500),
    },
  });
  // Keep a bounded number of active sessions per account.
  const active = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { lastUsedAt: "desc" },
    select: { id: true },
    take: 21,
  });
  if (active.length > 20) {
    await prisma.session.updateMany({
      where: { id: { in: active.slice(20).map((session) => session.id) } },
      data: { revokedAt: now },
    });
  }
  setSessionCookie(res, raw);
}

export async function register(req: Request, res: Response) {
  const values = req.body as { name: string; email: string; password: string };
  const passwordHash = await hash(values.password, argonOptions);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: values.name,
        email: values.email,
        passwordHash,
        role: "REQUESTER",
        preferredLanguage: resolveLocale(req),
        notificationPreference: { create: {} },
      },
      include: { teamMemberships: { where: { active: true }, include: { team: true }, take: 1 } },
    });
    await writeAudit(tx, req, { actorId: created.id, action: "user.registered", resourceType: "User", resourceId: created.id });
    return created;
  });
  await newSession(req, res, user.id);
  return { user: toUserDto(user) };
}

export async function login(req: Request, res: Response) {
  const values = req.body as { email: string; password: string };
  const user = await prisma.user.findUnique({
    where: { email: values.email },
    include: { teamMemberships: { where: { active: true }, include: { team: true }, take: 1 } },
  });
  dummyHashPromise ??= hash("not-a-valid-user-password", argonOptions);
  if (!user) {
    await verify(await dummyHashPromise, values.password, argonOptions).catch(() => false);
    await writeAudit(prisma, req, { action: "auth.login.failed", resourceType: "User", resourceId: null, outcome: "DENIED" });
    throw unauthorized();
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    await verify(user.passwordHash, values.password, argonOptions).catch(() => false);
    throw unauthorized();
  }
  const valid = await verify(user.passwordHash, values.password, argonOptions).catch(() => false);
  if (!valid || !user.active || user.deletedAt) {
    const failedAttempts = user.failedLoginAttempts + 1;
    const lockedUntil = failedAttempts >= env.LOGIN_MAX_ATTEMPTS
      ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60 * 1000)
      : null;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { failedLoginAttempts: failedAttempts, lockedUntil } });
      await writeAudit(tx, req, { actorId: user.id, action: "auth.login.failed", resourceType: "User", resourceId: user.id, outcome: "DENIED" });
    });
    throw unauthorized();
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now } });
  await writeAudit(prisma, req, { actorId: user.id, action: "auth.login.succeeded", resourceType: "User", resourceId: user.id });
  await newSession(req, res, user.id);
  return { user: toUserDto(user) };
}

export async function logout(req: Request, res: Response): Promise<void> {
  const raw = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (typeof raw === "string") {
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (session && !session.revokedAt) {
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      await writeAudit(prisma, req, { actorId: session.userId, action: "auth.logout", resourceType: "Session", resourceId: session.id });
    }
  }
  clearSessionCookie(res);
}

export async function changePassword(req: Request, user: AuthenticatedUser) {
  const values = req.body as { currentPassword: string; newPassword: string };
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record || !await verify(record.passwordHash, values.currentPassword, argonOptions).catch(() => false)) throw unauthorized();
  const passwordHash = await hash(values.newPassword, argonOptions);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, req, { actorId: user.id, action: "auth.password.changed", resourceType: "User", resourceId: user.id });
  });
}

export async function requestPasswordReset(req: Request): Promise<void> {
  const email = (req.body as { email: string }).email;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, preferredLanguage: true, active: true } });
  if (!user || !user.active) return;
  const token = createToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
    await enqueueOutbox(tx, {
      key: `password-reset:${randomUUID()}`,
      topic: "auth.password-reset",
      payload: {
        to: user.email,
        locale: user.preferredLanguage === "am" ? "am" : "en",
        secret: encryptSecret(token),
      },
    });
    await writeAudit(tx, req, { action: "auth.password-reset.requested", resourceType: "User", resourceId: user.id });
  });
}

export async function resetPassword(req: Request): Promise<void> {
  const values = req.body as { token: string; password: string };
  const tokenHash = hashToken(values.token);
  const passwordHash = await hash(values.password, argonOptions);
  await prisma.$transaction(async (tx) => {
    const token = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!token || token.consumedAt || token.expiresAt <= new Date()) throw unauthorized();
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: token.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw conflict("RESET_TOKEN_USED", "This password reset link can no longer be used.");
    await tx.user.update({ where: { id: token.userId }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } });
    await tx.session.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, req, { actorId: token.userId, action: "auth.password.reset", resourceType: "User", resourceId: token.userId });
  });
}

export async function revokeOtherSessions(userId: string, currentTokenHash?: string): Promise<number> {
  const sessions = await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}) },
    data: { revokedAt: new Date() },
  });
  return sessions.count;
}
