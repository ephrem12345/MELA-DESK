'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatCards, TicketTable } from "@/components/ticket-views";
import { Card, Button, TableSkeleton, ErrorState } from "@/components/ui";
import { metaApi, ticketApi, isMockMode } from "@/lib/api/client";
import { mockDashboardStats, mockTickets } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import type { DashboardStats, Ticket } from "@/lib/api/types";

export default function TeamDashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (isMockMode()) throw new Error("mock");
        const [s, list] = await Promise.all([metaApi.dashboardStats(), ticketApi.list({ pageSize: 8 })]);
        if (!alive) return;
        setStats(s);
        setTickets(list.items.slice(0, 6));
      } catch {
        if (isMockMode()) {
          if (!alive) return;
          setStats(mockDashboardStats("TEAM_LEAD"));
          setTickets(mockTickets.slice(4, 10));
        } else if (alive) setError(t("errors.generic"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.teamDashboard")}</h1>
      {error && <ErrorState message={error} />}
      {loading && !error && <TableSkeleton rows={3} cols={6} />}
      {!error && stats && <StatCards stats={stats} />}
      {!error && !loading && (
        <Card title={t("nav.queue")} actions={<Link href="/team/queue"><Button variant="secondary">{t("dashboard.viewAll")}</Button></Link>}>
          <TicketTable tickets={tickets} showRequester />
        </Card>
      )}
    </div>
  );
}
