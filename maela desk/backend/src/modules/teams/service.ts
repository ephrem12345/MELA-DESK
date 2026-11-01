import type { Request } from "express";
import { prisma } from "../../config/database.js";
import { forbidden, notFound } from "../../errors/app-error.js";
import { writeAudit } from "../../services/audit.js";
import type { AuthenticatedUser } from "../../types/express.js";
import type { teamCreateSchema, teamMemberSchema, teamUpdateSchema } from "./schemas.js";
import type { z } from "zod";

function teamDto(team: { id: string; name: string; description: string | null; departmentId: string | null; active: boolean; createdAt: Date; updatedAt: Date; department?: { name: string } | null; members?: { membershipRole?: string; user: { id: string; name: string; email: string; role: string; active: boolean } }[]; _count?: { tickets: number } }) {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    departmentId: team.departmentId,
    departmentName: team.department?.name ?? null,
    lead: team.members?.find((membership) => membership.membershipRole === "LEAD")?.user.name ?? "Unassigned",
    active: team.active,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
    members: team.members?.map(({ user }) => ({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active })),
    memberCount: team.members?.length ?? 0,
    openTickets: team._count?.tickets ?? 0,
  };
}

function canManageTeam(user: AuthenticatedUser, teamId: string): boolean {
  return user.role === "ADMIN" || (user.role === "TEAM_LEAD" && user.teamIds.includes(teamId));
}

export async function listTeams(user: AuthenticatedUser, filters: { departmentId?: string; active?: "true" | "false"; q?: string }) {
  const where = {
    ...(user.role === "ADMIN" ? {} : { id: { in: user.teamIds } }),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.active ? { active: filters.active === "true" } : {}),
    ...(filters.q ? { name: { contains: filters.q } } : {}),
  };
  const teams = await prisma.team.findMany({ where, include: { department: { select: { name: true } }, members: { where: { active: true, membershipRole: "LEAD" }, include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } }, take: 1 }, _count: { select: { tickets: { where: { deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] } } } } } }, orderBy: { name: "asc" }, take: 100 });
  return { items: teams.map(teamDto), total: teams.length };
}

export async function getTeam(user: AuthenticatedUser, id: string) {
  if (user.role !== "ADMIN" && !user.teamIds.includes(id)) throw notFound();
  const team = await prisma.team.findUnique({ where: { id }, include: { department: { select: { name: true } }, members: { where: { active: true }, include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } } }, _count: { select: { tickets: { where: { deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] } } } } } } });
  if (!team) throw notFound();
  return teamDto(team);
}

export async function createTeam(req: Request, data: z.infer<typeof teamCreateSchema>) {
  const team = await prisma.team.create({ data });
  await writeAudit(prisma, req, { actorId: req.authUser?.id, action: "team.created", resourceType: "Team", resourceId: team.id, afterData: { name: team.name, departmentId: team.departmentId } });
  return teamDto(team);
}

export async function updateTeam(req: Request, user: AuthenticatedUser, id: string, data: z.infer<typeof teamUpdateSchema>) {
  if (!canManageTeam(user, id)) throw forbidden();
  const before = await prisma.team.findUnique({ where: { id } });
  if (!before) throw notFound();
  const team = await prisma.team.update({ where: { id }, data });
  await writeAudit(prisma, req, { actorId: user.id, action: "team.updated", resourceType: "Team", resourceId: id, beforeData: { name: before.name, active: before.active }, afterData: data });
  return teamDto(team);
}

export async function listTeamMembers(user: AuthenticatedUser, teamId: string) {
  if (user.role !== "ADMIN" && !user.teamIds.includes(teamId)) throw notFound();
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) throw notFound();
  const members = await prisma.teamMember.findMany({ where: { teamId, active: true, user: { deletedAt: null } }, include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } }, orderBy: { joinedAt: "asc" } });
  return { items: members.map((member) => ({ ...member.user, membershipRole: member.membershipRole, joinedAt: member.joinedAt.toISOString() })), total: members.length };
}

export async function addTeamMember(req: Request, user: AuthenticatedUser, teamId: string, data: z.infer<typeof teamMemberSchema>) {
  if (!canManageTeam(user, teamId)) throw forbidden();
  const member = await prisma.user.findFirst({ where: { id: data.userId, active: true, deletedAt: null } });
  const team = await prisma.team.findFirst({ where: { id: teamId, active: true } });
  if (!member || !team) throw notFound();
  const result = await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId: data.userId } },
    create: { teamId, userId: data.userId, membershipRole: data.membershipRole, active: true },
    update: { membershipRole: data.membershipRole, active: true, joinedAt: new Date() },
  });
  await writeAudit(prisma, req, { actorId: user.id, action: "team.member.added", resourceType: "Team", resourceId: teamId, afterData: { userId: data.userId, membershipRole: result.membershipRole } });
  return { teamId, userId: result.userId, membershipRole: result.membershipRole };
}

export async function removeTeamMember(req: Request, user: AuthenticatedUser, teamId: string, userId: string): Promise<void> {
  if (!canManageTeam(user, teamId)) throw forbidden();
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
  if (!membership) throw notFound();
  await prisma.teamMember.update({ where: { teamId_userId: { teamId, userId } }, data: { active: false } });
  await writeAudit(prisma, req, { actorId: user.id, action: "team.member.removed", resourceType: "Team", resourceId: teamId, beforeData: { userId, membershipRole: membership.membershipRole } });
}
