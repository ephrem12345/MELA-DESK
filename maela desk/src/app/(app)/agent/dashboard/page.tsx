'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatCards, TicketTable } from "@/components/ticket-views";
import { Card, Button, EmptyState, ErrorState, TableSkeleton, useToast } from "@/components/ui";
import { metaApi, ticketApi, isMockMode } from "@/lib/api/client";
import { mockDashboardStats, mockTickets } from "@/lib/api/mock";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n/provider";
import type { DashboardStats, Ticket } from "@/lib/api/types";
import { SlaBadge } from "@/components/status-badges";

export default function AgentDashboardPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [assigned, setAssigned] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (isMockMode()) throw new Error("mock");
        const [s, list] = await Promise.all([metaApi.dashboardStats(), ticketApi.list({ pageSize: 8, sort: "updatedAt", sortDir: "asc" })]);
        if (!alive) return;
        setStats(s);
        setAssigned(list.items.slice(0, 6));
      } catch {
        if (isMockMode()) {
          if (!alive) return;
          setStats(mockDashboardStats("AGENT"));
          setAssigned(mockTickets.slice(0, 6));
        } else if (alive) {
          setError(t("errors.generic"));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  return (
    <div className="space-y-6">
      {error && <ErrorState message={error} />}
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.agentDashboard")}</h1>
      {loading && !error && <TableSkeleton rows={3} cols={6} />}
      {!error && stats && <StatCards stats={stats} />}
      {!error && !loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title={t("dashboard.assignedToMe")}
            actions={<Link href="/agent/assigned"><Button variant="secondary">{t("dashboard.viewAll")}</Button></Link>}
          >
            {assigned.length === 0 ? <EmptyState title={t("dashboard.agentQueueEmpty")} /> : <TicketTable tickets={assigned} showRequester />}
          </Card>
          <Card title={t("ticket.fields.number") + " + " + t("sla.due")}>
            <ul className="space-y-2">
              {assigned.slice(0, 4).map((tk) => (
                <li key={tk.id} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2.5 py-2 text-xs">
                  <Link href={`/tickets/${tk.id}`} className="font-medium text-blue-700 hover:underline">{tk.ticketNumber}</Link>
                  <SlaBadge indicator={tk.slaIndicator} dueAt={tk.slaDueAt} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      <p className="sr-only">{user?.email}</p>
    </div>
  );
}
