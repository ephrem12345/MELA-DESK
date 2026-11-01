import type { Request } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/database.js";

type AuditWriter = Pick<Prisma.TransactionClient, "auditLog"> | typeof prisma;
type AuditContext = Request | { requestId: string; ipAddress?: string | null; userAgent?: string | null };

export async function writeAudit(
  db: AuditWriter,
  req: AuditContext,
  event: {
    actorId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    beforeData?: unknown;
    afterData?: unknown;
    outcome?: "SUCCESS" | "DENIED" | "FAILURE";
  }
): Promise<void> {
  const request = "get" in req ? req : null;
  await db.auditLog.create({
    data: {
      actorId: event.actorId ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      requestId: req.requestId,
      ipAddress: request?.ip?.slice(0, 64) ?? ("ipAddress" in req ? req.ipAddress ?? null : null),
      userAgent: request?.get("user-agent")?.slice(0, 500) ?? ("userAgent" in req ? req.userAgent ?? null : null),
      beforeData: safeJson(event.beforeData),
      afterData: safeJson(event.afterData),
      outcome: event.outcome ?? "SUCCESS",
    },
  });
}

function safeJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
