import { hash, Algorithm } from "@node-rs/argon2";
import type { Request } from "express";
import { prisma } from "../../config/database.js";
import { conflict, forbidden, notFound } from "../../errors/app-error.js";
import { writeAudit } from "../../services/audit.js";
import type { AuthenticatedUser } from "../../types/express.js";
import type { createUserSchema, updateUserSchema, usersQuery } from "./schemas.js";
import type { z } from "zod";

const argonOptions = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };
type UsersQuery = z.infer<typeof usersQuery>;

function userDto(user: {
  id: string; name: string; email: string; role: AuthenticatedUser["role"]; createdAt: Date; active: boolean;
  departmentId: string | null; preferredLanguage: string; timeZone: string; teamMemberships: { team: { id: string; name: string } }[];
}) {
  const team = user.teamMemberships[0]?.team;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: team?.id ?? null,
    teamName: team?.name ?? null,
    departmentId: user.departmentId,
    preferredLanguage: user.preferredLanguage,
    timeZone: user.timeZone,
    createdAt: user.createdAt.toISOString(),
    active: user.active,
  };
}

function visibilityWhere(actor: AuthenticatedUser) {
  if (actor.role === "ADMIN") return {};
  if (actor.role === "TEAM_LEAD" && actor.teamIds.length) return { teamMemberships: { some: { teamId: { in: actor.teamIds }, active: true } } };
  return { id: actor.id };
}

export async function listUsers(actor: AuthenticatedUser, filters: UsersQuery) {
  if (actor.role !== "ADMIN" && actor.role !== "TEAM_LEAD") throw forbidden();
  const where = {
    deletedAt: null,
    ...visibilityWhere(actor),
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.active ? { active: filters.active === "true" } : {}),
    ...(filters.q ? { OR: [{ name: { contains: filters.q } }, { email: { contains: filters.q } }] } : {}),
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, include: { teamMemberships: { where: { active: true }, include: { team: { select: { id: true, name: true } } }, take: 1 } }, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    prisma.user.count({ where }),
  ]);
  return { items: users.map(userDto), total, page: filters.page, pageSize: filters.pageSize };
}

export async function getUser(actor: AuthenticatedUser, id: string) {
  if (actor.role !== "ADMIN" && actor.role !== "TEAM_LEAD" && actor.id !== id) throw forbidden();
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null, ...visibilityWhere(actor) }, include: { teamMemberships: { where: { active: true }, include: { team: { select: { id: true, name: true } } }, take: 1 } } });
  if (!user) throw notFound();
  return userDto(user);
}

export async function createUser(req: Request, input: z.infer<typeof createUserSchema>) {
  const passwordHash = await hash(input.password, argonOptions);
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        departmentId: input.departmentId ?? null,
        preferredLanguage: input.preferredLanguage,
        notificationPreference: { create: {} },
      },
    });
    if (input.teamId) await tx.teamMember.create({ data: { teamId: input.teamId, userId: user.id, membershipRole: input.role === "TEAM_LEAD" ? "LEAD" : "MEMBER" } });
    await writeAudit(tx, req, { actorId: req.authUser?.id, action: "user.created", resourceType: "User", resourceId: user.id, afterData: { email: user.email, role: user.role } });
    return user.id;
  });
  return getUser(req.authUser!, created);
}

export async function updateUser(req: Request, id: string, input: z.infer<typeof updateUserSchema>) {
  if (req.authUser?.role !== "ADMIN" && (req.authUser?.id !== id || input.email !== undefined || input.departmentId !== undefined)) throw forbidden();
  const before = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw notFound();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: input });
    await writeAudit(tx, req, { actorId: req.authUser?.id, action: "user.updated", resourceType: "User", resourceId: id, beforeData: { name: before.name, email: before.email }, afterData: input });
  });
  return getUser(req.authUser!, id);
}

export async function setUserActive(req: Request, id: string, active: boolean) {
  const before = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw notFound();
  await prisma.$transaction(async (tx) => {
    if (!active && before.role === "ADMIN") {
      const activeAdmins = await tx.user.count({ where: { role: "ADMIN", active: true, deletedAt: null } });
      if (activeAdmins <= 1) throw conflict("LAST_ADMIN", "The last active administrator cannot be deactivated.");
    }
    await tx.user.update({ where: { id }, data: { active } });
    if (!active) await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, req, { actorId: req.authUser?.id, action: active ? "user.activated" : "user.deactivated", resourceType: "User", resourceId: id, beforeData: { active: before.active }, afterData: { active } });
  }, { isolationLevel: "Serializable" });
  return getUser(req.authUser!, id);
}

export async function setUserRole(req: Request, id: string, role: AuthenticatedUser["role"]) {
  const before = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw notFound();
  await prisma.$transaction(async (tx) => {
    if (before.role === "ADMIN" && role !== "ADMIN") {
      const activeAdmins = await tx.user.count({ where: { role: "ADMIN", active: true, deletedAt: null } });
      if (activeAdmins <= 1) throw conflict("LAST_ADMIN", "The last active administrator cannot be demoted.");
    }
    await tx.user.update({ where: { id }, data: { role } });
    await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, req, { actorId: req.authUser?.id, action: "user.role.changed", resourceType: "User", resourceId: id, beforeData: { role: before.role }, afterData: { role } });
  }, { isolationLevel: "Serializable" });
  return getUser(req.authUser!, id);
}
