import "dotenv/config";
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { logger } from "./config/logger.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("The development seed must never run in production.");
}
if (!process.env.DATABASE_URL || !process.env.DEV_SEED_PASSWORD) {
  throw new Error("Set DATABASE_URL and DEV_SEED_PASSWORD in backend/.env before seeding.");
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 3306),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: decodeURIComponent(databaseUrl.pathname.replace(/^\//, "")),
    connectionLimit: 4,
  }),
});

async function main() {
  const passwordHash = await hash(process.env.DEV_SEED_PASSWORD!, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
  const department = await prisma.department.upsert({
    where: { code: "IT" },
    create: { name: "Information Technology", code: "IT", description: "Information technology services" },
    update: { name: "Information Technology", active: true },
  });
  const team = await prisma.team.upsert({
    where: { name: "Service Desk" },
    create: { name: "Service Desk", description: "Front-line support team", departmentId: department.id },
    update: { description: "Front-line support team", departmentId: department.id, active: true },
  });

  const categories = [
    { name: "hardware", labelEn: "Hardware", labelAm: "ሃርድዌር", displayOrder: 1 },
    { name: "software", labelEn: "Software", labelAm: "ሶፍትዌር", displayOrder: 2 },
    { name: "network", labelEn: "Network & connectivity", labelAm: "ኔትወርክ", displayOrder: 3 },
    { name: "account-access", labelEn: "Account & access", labelAm: "መለያ እና መዳረሻ", displayOrder: 4 },
    { name: "email", labelEn: "Email issues", labelAm: "የኢሜይል ችግሮች", parentName: "software", displayOrder: 5 },
  ];
  const categoryIds = new Map<string, string>();
  for (const item of categories.filter((category) => !("parentName" in category))) {
    const saved = await prisma.category.upsert({
      where: { name: item.name },
      create: { name: item.name, labelEn: item.labelEn, labelAm: item.labelAm, displayOrder: item.displayOrder, active: true },
      update: { labelEn: item.labelEn, labelAm: item.labelAm, displayOrder: item.displayOrder, active: true },
    });
    categoryIds.set(item.name, saved.id);
  }
  const child = categories.find((category) => "parentName" in category);
  if (child && "parentName" in child) {
    const parentCategoryId = categoryIds.get(child.parentName as string) ?? undefined;
    await prisma.category.upsert({
      where: { name: child.name },
      create: { name: child.name, labelEn: child.labelEn, labelAm: child.labelAm, parentId: parentCategoryId, displayOrder: child.displayOrder, active: true },
      update: { labelEn: child.labelEn, labelAm: child.labelAm, parentId: parentCategoryId, displayOrder: child.displayOrder, active: true },
    });
  }

  const prioritySeeds = [
    { code: "LOW" as const, name: "Low", level: 1, firstResponseMinutes: 1440, resolutionMinutes: 10080 },
    { code: "NORMAL" as const, name: "Normal", level: 2, firstResponseMinutes: 480, resolutionMinutes: 2880 },
    { code: "HIGH" as const, name: "High", level: 3, firstResponseMinutes: 120, resolutionMinutes: 720 },
    { code: "URGENT" as const, name: "Urgent", level: 4, firstResponseMinutes: 30, resolutionMinutes: 240 },
  ];
  const priorities = new Map<string, string>();
  for (const item of prioritySeeds) {
    const priority = await prisma.priority.upsert({
      where: { code: item.code },
      create: { ...item, active: true },
      update: { name: item.name, level: item.level, firstResponseMinutes: item.firstResponseMinutes, resolutionMinutes: item.resolutionMinutes, active: true },
    });
    priorities.set(item.code, priority.id);
    await prisma.slaPolicy.upsert({
      where: { priorityId: priority.id },
      create: { priorityId: priority.id, warningMinutes: Math.min(60, item.firstResponseMinutes) },
      update: { warningMinutes: Math.min(60, item.firstResponseMinutes), active: true },
    });
  }

  const users = [
    { email: "requester@meladesk.test", name: "Sara Bekele", role: "REQUESTER" as const, team: false },
    { email: "agent@meladesk.test", name: "Dawit Haile", role: "AGENT" as const, team: true },
    { email: "lead@meladesk.test", name: "Hanna Girma", role: "TEAM_LEAD" as const, team: true },
    { email: "admin@meladesk.test", name: "Admin User", role: "ADMIN" as const, team: false },
    { email: "agent2@meladesk.test", name: "Michael Tesfaye", role: "AGENT" as const, team: true },
  ];
  const userIds = new Map<string, string>();
  for (const item of users) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      create: { email: item.email, name: item.name, role: item.role, passwordHash, departmentId: department.id, preferredLanguage: "en", timeZone: "Africa/Addis_Ababa", notificationPreference: { create: {} } },
      update: { name: item.name, role: item.role, passwordHash, active: true, deletedAt: null },
    });
    userIds.set(item.email, user.id);
    if (item.team) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: user.id } },
        create: { teamId: team.id, userId: user.id, membershipRole: item.role === "TEAM_LEAD" ? "LEAD" : "MEMBER", active: true },
        update: { active: true, membershipRole: item.role === "TEAM_LEAD" ? "LEAD" : "MEMBER" },
      });
    }
  }

  await prisma.ticketSequence.upsert({ where: { id: 1 }, create: { id: 1, lastValue: 1002n }, update: {} });
  const ticketSeed = [
    { ticketNumber: "MD-001000", subject: "Cannot print to office printer", description: "The office printer is not responding to print jobs.", status: "OPEN" as const, category: "hardware", priority: "LOW" as const },
    { ticketNumber: "MD-001001", subject: "Email inbox not syncing on mobile", description: "New email is not appearing on the mobile device.", status: "IN_PROGRESS" as const, category: "email", priority: "NORMAL" as const },
    { ticketNumber: "MD-001002", subject: "VPN connection drops every hour", description: "The VPN disconnects during active work sessions.", status: "RESOLVED" as const, category: "network", priority: "HIGH" as const },
  ];
  for (const item of ticketSeed) {
    const categoryId = categoryIds.get(item.category) ?? (await prisma.category.findUniqueOrThrow({ where: { name: item.category } })).id;
    const priorityId = priorities.get(item.priority)!;
    const existing = await prisma.ticket.findUnique({ where: { ticketNumber: item.ticketNumber } });
    if (existing) continue;
    const createdAt = new Date(Date.now() - 2 * 86400000);
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: item.ticketNumber,
        subject: item.subject,
        description: item.description,
        requesterId: userIds.get("requester@meladesk.test")!,
        assignedTeamId: team.id,
        assignedAgentId: userIds.get("agent@meladesk.test")!,
        departmentId: department.id,
        categoryId,
        priorityId,
        status: item.status,
        createdAt,
        updatedAt: createdAt,
        dueAt,
        resolvedAt: item.status === "RESOLVED" ? createdAt : null,
        statusHistory: {
          create: item.status === "OPEN"
            ? [{ previousStatus: null, newStatus: "OPEN", changedById: userIds.get("requester@meladesk.test")!, createdAt }]
            : [
                { previousStatus: null, newStatus: "OPEN", changedById: userIds.get("requester@meladesk.test")!, createdAt },
                { previousStatus: "OPEN", newStatus: item.status, changedById: userIds.get("agent@meladesk.test")!, createdAt: new Date(createdAt.getTime() + 30 * 60 * 1000) },
              ],
        },
        assignments: { create: { assignedToTeamId: team.id, assignedToUserId: userIds.get("agent@meladesk.test")!, assignedById: userIds.get("lead@meladesk.test")!, assignedAt: createdAt } },
        slaTracking: { create: { firstResponseDueAt: dueAt, resolutionDueAt: dueAt } },
        comments: { create: { authorId: userIds.get("requester@meladesk.test")!, body: item.description, visibility: "PUBLIC", createdAt } },
      },
    });
    void ticket;
  }
  logger.info({ categories: categories.length, priorities: prioritySeeds.length, users: users.length, teams: 1 }, "development seed completed");
}

main().catch((error) => {
  console.error("Development seed failed.", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
