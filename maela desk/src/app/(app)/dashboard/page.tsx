"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageSquareText,
  Plus,
  RefreshCw,
  Sparkles,
  Ticket as TicketIcon,
} from "lucide-react";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { StatCards } from "@/components/ticket-views";
import { PriorityBadge, StatusBadge } from "@/components/status-badges";
import { ApiError, isMockMode, metaApi, ticketApi } from "@/lib/api/client";
import { mockDashboardStats, mockTickets } from "@/lib/api/mock";
import type { DashboardStats, NotificationItem, Ticket } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/provider";
import { useSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";

const statusRows = [
  { key: "open", labelKey: "status.open", valueKey: "open", color: "bg-blue-500", icon: Inbox },
  { key: "inProgress", labelKey: "status.in_progress", valueKey: "inProgress", color: "bg-violet-500", icon: Clock3 },
  { key: "pending", labelKey: "dashboard.pendingTickets", valueKey: "pending", color: "bg-amber-500", icon: Activity },
  { key: "resolved", labelKey: "status.resolved", valueKey: "resolved", color: "bg-emerald-500", icon: CheckCircle2 },
] as const;

function StatusOverview({ stats }: { stats: DashboardStats }) {
  const { t } = useI18n();
  const values = statusRows.map((row) => ({ ...row, total: stats[row.valueKey] }));
  const max = Math.max(...values.map((row) => row.total), 1);

  return (
    <div>
      <p className="mb-5 text-xs leading-5 text-slate-500">{t("dashboard.statusOverviewHint")}</p>
      <ul className="space-y-4">
        {values.map((row) => {
          const Icon = row.icon;
          const width = row.total === 0 ? 0 : Math.max(6, (row.total / max) * 100);
          return (
            <li key={row.key}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-600">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    <Icon aria-hidden className="size-3.5" />
                  </span>
                  <span className="truncate">{t(row.labelKey)}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate-800">{row.total}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div className={`h-full rounded-full ${row.color} transition-[width] duration-500`} style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecentTicket({ ticket }: { ticket: Ticket }) {
  const { locale, t } = useI18n();

  return (
    <li>
      <Link
        href={`/tickets/${ticket.id}`}
        className="group flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-3.5 transition hover:border-blue-200 hover:bg-blue-50/40 sm:flex-row sm:items-center sm:justify-between sm:px-4"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
            <span className="font-semibold tracking-wide text-blue-700">{ticket.ticketNumber}</span>
            <span aria-hidden className="text-slate-300">•</span>
            <span>{locale === "am" ? ticket.category.labelAm : ticket.category.labelEn}</span>
            <span aria-hidden className="text-slate-300">•</span>
            <span>{t("dashboard.updatedAt", { date: formatDate(ticket.updatedAt, locale) })}</span>
          </div>
          <p className="truncate text-sm font-semibold text-slate-800 transition group-hover:text-blue-700">{ticket.subject}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
          <ArrowRight aria-hidden className="ml-1 hidden size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500 sm:block" />
        </div>
      </Link>
    </li>
  );
}

function ReplyItem({ reply, locale }: { reply: NotificationItem; locale: string }) {
  const { t } = useI18n();
  return (
    <li className="relative flex gap-3">
      <div className="relative flex w-9 shrink-0 justify-center">
        <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <MessageSquareText aria-hidden className="size-4" />
        </span>
      </div>
      <div className="min-w-0 flex-1 border-b border-slate-100 pb-4 last:border-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-5 text-slate-800">{reply.title}</p>
          {!reply.read && <span aria-label={t("notifications.unread")} className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" />}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{reply.message}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
          <span>{formatDate(reply.createdAt, locale)}</span>
          {reply.ticketId && (
            <>
              <span aria-hidden>·</span>
              <Link href={`/tickets/${reply.ticketId}`} className="font-medium text-blue-700 hover:underline">
                {reply.ticketNumber ?? t("dashboard.openTicket")}
              </Link>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { user } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Ticket[]>([]);
  const [replies, setReplies] = useState<NotificationItem[]>([]);
  const [repliesUnavailable, setRepliesUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const [statsResult, notificationsResult, ticketsResult] = await Promise.allSettled([
        metaApi.dashboardStats(),
        metaApi.notifications(),
        ticketApi.list({ pageSize: 6, sort: "updatedAt", sortDir: "desc" }),
      ]);

      if (statsResult.status === "fulfilled") setStats(statsResult.value);
      else if (isMockMode()) setStats(mockDashboardStats(user?.role ?? "REQUESTER"));

      if (ticketsResult.status === "fulfilled") setRecent(ticketsResult.value.items.slice(0, 6));
      else if (isMockMode()) setRecent(mockTickets.slice(0, 6));

      if (notificationsResult.status === "fulfilled") {
        setReplies(notificationsResult.value.items.filter((item) => item.category === "reply").slice(0, 4));
        setRepliesUnavailable(false);
      } else {
        setReplies([]);
        setRepliesUnavailable(true);
      }

      const coreFailure = statsResult.status === "rejected" || ticketsResult.status === "rejected";
      if (coreFailure && !isMockMode()) {
        const cause = statsResult.status === "rejected" ? statsResult.reason : ticketsResult.status === "rejected" ? ticketsResult.reason : null;
        setError(cause instanceof ApiError ? t(`errors.${cause.message}`) : t("errors.generic"));
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? t(`errors.${cause.message}`) : t("errors.generic"));
    } finally {
      setInitial(false);
      setRefreshing(false);
    }
  }, [t, user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 animate-fade-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">{t("dashboard.overviewEyebrow")}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{t("dashboard.welcome", { name: user?.name ?? "" })}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw aria-hidden className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? t("dashboard.refreshing") : t("dashboard.refresh")}
          </Button>
          <Link href="/tickets/new">
            <Button>
              <Plus aria-hidden className="size-4" /> {t("nav.newTicket")}
            </Button>
          </Link>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <Button variant="secondary" onClick={() => void load()} disabled={refreshing}>{t("common.retry")}</Button>
        </div>
      )}

      {initial ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label={t("common.loading")}>
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
        </div>
      ) : stats ? (
        <StatCards stats={stats} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.recentTickets")}</h2>
              <p className="mt-0.5 text-xs font-normal text-slate-500">{t("dashboard.recentTicketsHint")}</p>
            </div>
          }
          actions={
            <Link href="/tickets" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800">
              {t("dashboard.viewAll")} <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          }
        >
          {initial ? (
            <ul className="space-y-2.5" role="status" aria-label={t("common.loading")}>
              {Array.from({ length: 5 }).map((_, index) => (
                <li key={index} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <div className="hidden gap-2 sm:flex"><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-6 w-24 rounded-full" /></div>
                </li>
              ))}
            </ul>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<TicketIcon className="size-9" />}
              title={t("dashboard.emptyRecent")}
              description={t("dashboard.createFirst")}
              action={<Link href="/tickets/new"><Button>{t("nav.newTicket")}</Button></Link>}
            />
          ) : (
            <ul className="space-y-2.5">
              {recent.map((ticket) => <RecentTicket key={ticket.id} ticket={ticket} />)}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card
            title={
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.statusOverview")}</h2>
                <p className="mt-0.5 text-xs font-normal text-slate-500">{t("dashboard.statusOverviewCaption")}</p>
              </div>
            }
          >
            {initial || !stats ? (
              <div className="space-y-5" aria-hidden="true">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-9" />)}
              </div>
            ) : <StatusOverview stats={stats} />}
          </Card>

          <Card
            title={
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.recentReplies")}</h2>
                <p className="mt-0.5 text-xs font-normal text-slate-500">{t("dashboard.recentRepliesHint")}</p>
              </div>
            }
          >
            {initial ? (
              <div className="space-y-4" aria-hidden="true">
                {Array.from({ length: 2 }).map((_, index) => <div key={index} className="flex gap-3"><Skeleton className="size-9 shrink-0 rounded-xl" /><Skeleton className="h-14 flex-1" /></div>)}
              </div>
            ) : repliesUnavailable ? (
              <p className="rounded-lg bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">{t("dashboard.repliesUnavailable")}</p>
            ) : replies.length === 0 ? (
              <div className="py-4 text-center">
                <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400"><MessageSquareText aria-hidden className="size-4" /></span>
                <p className="text-sm font-medium text-slate-700">{t("notifications.empty")}</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-500">{t("dashboard.noRepliesHint")}</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {replies.map((reply) => <ReplyItem key={reply.id} reply={reply} locale={locale} />)}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-700 to-indigo-800 px-5 py-6 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:px-7">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-20 size-64 rounded-full border-[36px] border-white/5" />
        <div className="relative flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-blue-100 ring-1 ring-white/15"><Sparkles aria-hidden className="size-5" /></span>
          <div>
            <h2 className="text-base font-semibold">{t("dashboard.needHelpTitle")}</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-blue-100">{t("dashboard.needHelpDescription")}</p>
          </div>
        </div>
        <Link href="/tickets/new" className="relative mt-5 inline-flex shrink-0 sm:mt-0">
          <Button className="bg-white text-blue-700 hover:bg-blue-50">
            <Plus aria-hidden className="size-4" /> {t("dashboard.createRequest")}
          </Button>
        </Link>
      </section>
    </div>
  );
}
