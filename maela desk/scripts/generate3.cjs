/**
 * Generates the remaining role-based pages: agent, team-lead and administration.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(process.cwd(), "src", "app", "(app)");

const page = (route, code) => {
  const dir = path.join(ROOT, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), code.trim() + "\n");
  console.log("wrote", route);
};

/* Agent queue pages --------------------------------------------------------- */

page("agent/assigned",
"'use client';\n\nimport { useI18n } from '@/lib/i18n/provider';\nimport { TicketListViewWithSuspense } from '@/components/ticket-list-view';\n\nexport default function AgentAssignedPage() {\n  const { t } = useI18n();\n  return <TicketListViewWithSuspense title={t(\"nav.assigned\")} />;\n}\n");

page("agent/queue",
"'use client';\n\nimport { useI18n } from '@/lib/i18n/provider';\nimport { TicketListViewWithSuspense } from '@/components/ticket-list-view';\n\nexport default function AgentQueuePage() {\n  const { t } = useI18n();\n  return <TicketListViewWithSuspense title={t(\"nav.queue\")} preset={{ status: \"OPEN\" }} />;\n}\n");

page("agent/escalated",
"'use client';\n\nimport { useI18n } from '@/lib/i18n/provider';\nimport { TicketListViewWithSuspense } from '@/components/ticket-list-view';\n\nexport default function EscalatedPage() {\n  const { t } = useI18n();\n  return <TicketListViewWithSuspense title={t(\"nav.escalated\")} preset={{ priority: \"URGENT\" }} />;\n}\n");

page("agent/tickets",
"'use client';\n\nimport { useEffect } from 'react';\nimport { useRouter } from 'next/navigation';\n\nexport default function AgentTicketsIndex() {\n  const router = useRouter();\n  useEffect(() => router.replace('/agent/assigned'), [router]);\n  return null;\n}\n");

page("agent/team",
"'use client';\n\nimport { useI18n } from '@/lib/i18n/provider';\nimport { PageHeader } from '@/components/admin-shared';\nimport { TicketListViewWithSuspense } from '@/components/ticket-list-view';\n\nexport default function AgentTeamPage() {\n  const { t } = useI18n();\n  return (\n    <div className=\"space-y-4\">\n      <PageHeader title={t('nav.agentTeam')} />\n      <TicketListViewWithSuspense />\n    </div>\n  );\n}\n");

page("team/queue",
"'use client';\n\nimport { useI18n } from '@/lib/i18n/provider';\nimport { TicketListViewWithSuspense } from '@/components/ticket-list-view';\n\nexport default function TeamQueuePage() {\n  const { t } = useI18n();\n  return <TicketListViewWithSuspense title={t('nav.queue')} />;\n}\n");

/* Agent dashboard ----------------------------------------------------------- */

page("agent/dashboard",
`
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
                  <Link href={\`/tickets/\${tk.id}\`} className="font-medium text-blue-700 hover:underline">{tk.ticketNumber}</Link>
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
`);

/* Team dashboard ------------------------------------------------------------ */

page("team/dashboard",
`
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
`);

/* Team agents --------------------------------------------------------------- */

page("team/agents",
`
'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Card, ErrorState, TableSkeleton } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import type { User } from "@/lib/api/types";

export default function TeamAgentsPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await metaApi.users({ pageSize: 25 });
        if (!alive) return;
        setUsers(res.items);
      } catch {
        if (alive && isMockMode()) setUsers(mockUsers.filter((u) => u.role !== "ADMIN"));
        else if (alive) setError(t("errors.generic"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.agents")} subtitle={t("dashboard.teamOverview")} />
      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={4} cols={4} />}
      {!loading && users && (
        <Card title={t("dashboard.teamOverview")}>
          <DataTable
            headers={[t("admin.name"), t("admin.role"), t("admin.team"), t("admin.accountStatus")]}
            rows={users.map((u) => [
              u.name,
              <Badge key={u.id} tone="info">{t(\`roles.\${u.role.toLowerCase()}\`)}</Badge>,
              u.teamName ?? "—",
              <Badge key={u.id + "-s"} tone={u.active ? "success" : "danger"}>{u.active ? t("admin.active") : t("admin.inactive")}</Badge>,
            ])}
          />
        </Card>
      )}
    </div>
  );
}
`);

console.log("done");
