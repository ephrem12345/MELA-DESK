"use client";

import Link from 'next/link';
import { Badge, type BadgeTone } from '@/components/ui';
import { PriorityBadge, StatusBadge } from '@/components/status-badges';
import { useI18n } from '@/lib/i18n/provider';
import { formatDate } from '@/lib/utils';
import type { DashboardStats, Ticket } from '@/lib/api/types';
import {
  Activity,
  AlarmClock,
  CheckCircle2,
  Clock3,
  Inbox,
  Ticket as TicketIcon,
} from "lucide-react";

const cardDefs: { key: string; icon: React.ReactNode; tone: BadgeTone; href: string }[] = [
  { key: "dashboard.totalTickets", icon: <TicketIcon className="size-4" />, tone: "primary", href: "/tickets" },
  { key: "dashboard.openTickets", icon: <Inbox className="size-4" />, tone: "info", href: "/tickets?status=OPEN" },
  { key: "dashboard.inProgressTickets", icon: <Clock3 className="size-4" />, tone: "info", href: "/tickets?status=IN_PROGRESS" },
  { key: "dashboard.pendingTickets", icon: <AlarmClock className="size-4" />, tone: "warning", href: "/tickets?status=PENDING_REQUESTER" },
  { key: "dashboard.resolvedTickets", icon: <CheckCircle2 className="size-4" />, tone: "success", href: "/tickets?status=RESOLVED" },
  { key: "dashboard.urgentTickets", icon: <Activity className="size-4" />, tone: "danger", href: "/tickets?priority=URGENT" },
];

export function StatCards({ stats, linkPrefix = "" }: { stats: DashboardStats; linkPrefix?: string }) {
  const { t } = useI18n();
  const values: Record<string, number> = {
    "dashboard.totalTickets": stats.total,
    "dashboard.openTickets": stats.open,
    "dashboard.inProgressTickets": stats.inProgress,
    "dashboard.pendingTickets": stats.pending,
    "dashboard.resolvedTickets": stats.resolved,
    "dashboard.urgentTickets": stats.urgent,
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cardDefs.map((c) => (
        <Link
          key={c.key}
          href={`${linkPrefix}${c.href.split("?")[0]}${c.href.includes("?") ? c.href.slice(c.href.indexOf("?")) : ""}`}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)] transition-colors hover:border-blue-300"
        >
          <div className="flex items-center justify-between">
            <Badge tone={c.tone}>{c.icon}</Badge>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{values[c.key]}</p>
          <p className="text-xs text-slate-500">{t(c.key)}</p>
        </Link>
      ))}
    </div>
  );
}

export function TicketTable({ tickets, showRequester = false }: { tickets: Ticket[]; showRequester?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-slate-500">
            <th className="pb-2 pr-3 font-medium">{t("ticket.fields.number")}</th>
            <th className="pb-2 pr-3 font-medium">{t("ticket.fields.subject")}</th>
            {showRequester && <th className="pb-2 pr-3 font-medium">{t("ticket.fields.requester")}</th>}
            <th className="pb-2 pr-3 font-medium">{t("ticket.fields.category")}</th>
            <th className="pb-2 pr-3 font-medium">{t("ticket.fields.priority")}</th>
            <th className="pb-2 pr-3 font-medium">{t("ticket.fields.status")}</th>
            <th className="pb-2 pr-3 font-medium">{t("ticket.fields.updatedAt")}</th>
            <th className="pb-2 font-medium sr-only">{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((tk) => (
            <tr key={tk.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
              <td className="py-2.5 pr-3">
                <Link href={`/tickets/${tk.id}`} className="font-medium text-blue-700 hover:underline">
                  {tk.ticketNumber}
                </Link>
              </td>
              <td className="py-2.5 pr-3">
                <Link href={`/tickets/${tk.id}`} className="text-slate-700 hover:underline">
                  {tk.subject}
                </Link>
              </td>
              {showRequester && <td className="py-2.5 pr-3 text-slate-600">{tk.requester.name}</td>}
              <td className="py-2.5 pr-3 text-slate-600">{locale === "am" ? tk.category.labelAm : tk.category.labelEn}</td>
              <td className="py-2.5 pr-3"><PriorityBadge priority={tk.priority} /></td>
              <td className="py-2.5 pr-3"><StatusBadge status={tk.status} /></td>
              <td className="py-2.5 pr-3 text-xs text-slate-500">{formatDate(tk.updatedAt, locale)}</td>
              <td className="py-2.5">
                <Link href={`/tickets/${tk.id}`} className="text-xs text-blue-600 hover:underline">
                  {t("common.view")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

