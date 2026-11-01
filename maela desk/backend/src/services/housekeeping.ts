import { unlink } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export async function runHousekeeping(): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 30 * 86400000) } }, { revokedAt: { lt: new Date(now.getTime() - 30 * 86400000) } }] } });
    await tx.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 30 * 86400000) } }, { consumedAt: { lt: new Date(now.getTime() - 30 * 86400000) } }] } });
    await tx.emailVerificationToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 30 * 86400000) } }, { consumedAt: { lt: new Date(now.getTime() - 30 * 86400000) } }] } });
    await tx.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: now } } });
    await tx.outboxEvent.deleteMany({ where: { status: "COMPLETED", processedAt: { lt: new Date(now.getTime() - 90 * 86400000) } } });
    await tx.outboxEvent.updateMany({ where: { status: "PROCESSING", claimedAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) } }, data: { status: "PENDING", claimedAt: null, nextAttemptAt: now } });
  });

  const expiredUploads = await prisma.attachment.findMany({ where: { ticketId: null, commentId: null, expiresAt: { lt: now }, deletedAt: null }, select: { id: true, storageKey: true } });
  if (!expiredUploads.length) return;
  await prisma.attachment.updateMany({ where: { id: { in: expiredUploads.map((item) => item.id) } }, data: { deletedAt: now } });
  const root = isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : resolve(process.cwd(), env.UPLOAD_DIR);
  await Promise.all(expiredUploads.map((item) => unlink(join(root, item.storageKey)).catch(() => undefined)));
}

export function startHousekeepingWorker(): NodeJS.Timeout {
  const timer = setInterval(() => {
    void runHousekeeping().catch((error) => logger.error({ errorName: error instanceof Error ? error.name : "Error" }, "housekeeping failed"));
  }, env.HOUSEKEEPING_INTERVAL_MS);
  timer.unref();
  return timer;
}
