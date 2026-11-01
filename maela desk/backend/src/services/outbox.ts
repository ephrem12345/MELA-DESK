import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { decryptSecret } from "./crypto.js";
import { type Locale, localized } from "./localization.js";

type EnqueueDb = Pick<import("../../generated/prisma/client.js").Prisma.TransactionClient, "outboxEvent">;
let transport: Transporter | null | undefined;
let workerBusy = false;

export async function enqueueOutbox(
  db: EnqueueDb,
  event: { key: string; topic: string; payload: unknown; maxAttempts?: number }
): Promise<void> {
  await db.outboxEvent.create({
    data: {
      eventKey: event.key,
      topic: event.topic,
      payload: event.payload as never,
      maxAttempts: event.maxAttempts ?? 8,
    },
  });
}

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  if (!env.SMTP_HOST) {
    transport = null;
    return transport;
  }
  transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000,
    socketTimeout: 20000,
  });
  return transport;
}

async function deliverResetEmail(payload: Record<string, unknown>): Promise<void> {
  const mailer = getTransport();
  if (!mailer) throw new Error("SMTP transport is not configured.");
  const to = String(payload.to ?? "");
  const locale: Locale = payload.locale === "am" ? "am" : "en";
  const encrypted = payload.secret as { algorithm: string; iv: string; tag: string; value: string };
  const token = decryptSecret(encrypted);
  const resetUrl = new URL("/reset-password", env.PUBLIC_APP_URL);
  resetUrl.searchParams.set("token", token);
  await mailer.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: localized(locale, "resetSubject"),
    text: `${localized(locale, "resetBody")}\n\n${resetUrl.toString()}`,
  });
}

async function dispatch(topic: string, payload: Record<string, unknown>): Promise<void> {
  if (topic === "auth.password-reset") return deliverResetEmail(payload);
  if (topic === "notification.email") {
    const mailer = getTransport();
    if (!mailer) throw new Error("SMTP transport is not configured.");
    await mailer.sendMail({
      from: env.SMTP_FROM,
      to: String(payload.to ?? ""),
      subject: String(payload.title ?? "MELA DESK notification"),
      text: String(payload.message ?? ""),
    });
    return;
  }
  throw new Error(`Unsupported outbox topic: ${topic}`);
}

export async function processOutboxBatch(batchSize = 10): Promise<number> {
  if (workerBusy) return 0;
  workerBusy = true;
  let processed = 0;
  try {
    const due = await prisma.outboxEvent.findMany({
      where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: "asc" },
      take: Math.max(1, Math.min(50, batchSize)),
    });
    for (const event of due) {
      const claimed = await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: "PENDING" },
        data: { status: "PROCESSING", claimedAt: new Date(), attempts: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;
      try {
        await dispatch(event.topic, event.payload as Record<string, unknown>);
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "COMPLETED", processedAt: new Date(), claimedAt: null, lastError: null },
        });
        processed += 1;
      } catch (error) {
        const attempts = event.attempts + 1;
        const terminal = attempts >= event.maxAttempts;
        const delaySeconds = Math.min(3600, 5 * 2 ** Math.min(attempts, 10));
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: terminal ? "FAILED" : "PENDING",
            nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
            claimedAt: null,
            lastError: `delivery failed (${error instanceof Error ? error.name : "unknown error"})`,
          },
        });
        logger.warn({ eventId: event.id, topic: event.topic, attempts, terminal }, "outbox delivery deferred");
      }
    }
  } finally {
    workerBusy = false;
  }
  return processed;
}

export function startOutboxWorker(): NodeJS.Timeout {
  const timer = setInterval(() => {
    void processOutboxBatch().catch((error) => logger.error({ err: error }, "outbox worker failed"));
  }, env.OUTBOX_INTERVAL_MS);
  timer.unref();
  return timer;
}
