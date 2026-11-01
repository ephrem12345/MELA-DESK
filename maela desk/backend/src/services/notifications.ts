import type { Prisma } from "../../generated/prisma/client.js";
import { type Locale, localized } from "./localization.js";
import { enqueueOutbox } from "./outbox.js";

type Tx = Prisma.TransactionClient;

export async function createNotification(
  tx: Tx,
  data: {
    recipientId: string;
    ticketId?: string | null;
    type: string;
    title: string;
    message: string;
    locale?: Locale;
    email?: string | null;
    emailEnabled?: boolean;
    eventKey: string;
  }
): Promise<void> {
  const locale = data.locale ?? "en";
  await tx.notification.create({
    data: {
      recipientId: data.recipientId,
      ticketId: data.ticketId ?? null,
      type: data.type,
      title: data.title,
      message: data.message,
      locale,
    },
  });
  if (data.email && data.emailEnabled) {
    await enqueueOutbox(tx, {
      key: data.eventKey,
      topic: "notification.email",
      payload: { to: data.email, title: data.title, message: data.message, locale },
    });
  }
}

export function ticketNotificationText(locale: Locale, kind: "created" | "assigned" | "reply" | "status" | "resolved") {
  const key = {
    created: "ticketCreated",
    assigned: "ticketAssigned",
    reply: "newReply",
    status: "statusChanged",
    resolved: "ticketResolved",
  } as const;
  return localized(locale, key[kind]);
}
