"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Select, TableSkeleton, useToast } from "@/components/ui";
import { metaApi, ApiError, isMockMode } from "@/lib/api/client";
import { mockNotifications } from "@/lib/api/mock";
import type { NotificationItem } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/provider";
import { useSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const { user } = useSession();
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await metaApi.notifications();
      setItems(items);
    } catch {
      if (isMockMode()) setItems(mockNotifications(user?.role ?? "REQUESTER"));
      else setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = filter === "unread" ? items.filter((n) => !n.read) : filter === "read" ? items.filter((n) => n.read) : items;

  const toneFor = (c: string): "primary" | "info" | "warning" | "neutral" =>
    c === "sla" ? "warning" : c === "assignment" ? "info" : c === "reply" ? "primary" : "neutral";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">{t("notifications.title")}</h1>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await metaApi.markAllNotificationsRead();
              setItems((prev) => prev.map((n) => ({ ...n, read: true })));
              toast.push("success", t("notifications.markAllRead"));
            } catch {
              toast.push("error", t("errors.generic"));
            }
          }}
        >
          <CheckCheck aria-hidden className="size-4" /> {t("notifications.markAllRead")}
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {loading && !error && <TableSkeleton rows={4} cols={3} />}
      {!loading && !error && visible.length === 0 && (
        <EmptyState icon={<Bell className="size-10" />} title={t("notifications.empty")} />
      )}
      {!loading && !error && visible.length > 0 && (
        <>
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40" aria-label={t("common.filters")}>
            <option value="">{t("common.all")}</option>
            <option value="unread">{t("notifications.unread")}</option>
            <option value="read">{t("status.resolved")}</option>
          </Select>
          <ul className="space-y-2">
            {visible.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border p-3 ${n.read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <Badge tone={toneFor(n.category)}>{t(`notifications.categories.${n.category}`)}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{n.message}</p>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  {n.ticketId && (
                    <Link href={`/tickets/${n.ticketId}`} className="font-medium text-blue-600 hover:underline">
                      {t("notifications.openTicket")} · {n.ticketNumber}
                    </Link>
                  )}
                  <span className="text-slate-400">{formatDate(n.createdAt, locale)}</span>
                  {!n.read && (
                    <button
                      className="text-slate-400 hover:text-blue-600 hover:underline"
                      onClick={async () => {
                        try {
                          await metaApi.markNotificationRead(n.id);
                          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                        } catch {
                          toast.push("error", t("errors.generic"));
                        }
                      }}
                    >
                      {t("notifications.markRead")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
