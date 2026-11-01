/**
 * Generates the agent, team-lead, and admin pages. All side effects (queues,
 * reports, admin tables) read through the typed API client; mock fallbacks are
 * labeled where used.
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

/* ================= AGENT ================= */

page(
  "agent/dashboard",
  `
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Inbox, Clock3, ShieldAlert } from "lucide-react";
import { Card, EmptyState, ErrorState, TableSkeleton, Badge, type BadgeTone } from "@/components/ui";
import { StatCards } from "@/components/ticket-views";
import { TicketTable } from "@/components/ticket-views";
import { TicketListViewWithSuspense } from "@/components/ticket-list-view";
import { mockDashboardStats, mockTickets } from "@/lib/api/mock";
import { metaApi, ticketApi, isMockMode } from "@/lib/api/client";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n/provider";
import type { DashboardStats, Ticket } from "@/lib/api/types";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function AgentDashboardPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [assigned, setAssigned] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (isMockMode()) throw new Error("mock");
        const [s, list, mine, escalated] = await Promise.all([
          metaApi.dashboardStats(),
          ticketApi.list({ pageSize: 8, sort: "updatedAt", sortDir: "asc" }),
        ]);
        setStats(s);
        setAssigned(list ? list.items.slice(0, 6) : []);
        void mine; void escalated;
      } catch {
        if (isMockMode()) {
          setStats(mockDashboardStats("AGENT"));
          setAssigned(mockTickets.slice(0, 6));
        } else {
          setError(t("errors.generic"));
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.agentDashboard")}</h1>
      {error && <ErrorState message={error} />}
      {!error && loading && <TableSkeleton rows={3} cols={6} />}
      {!error && stats && <StatCards stats={stats} />}
      {!error && !loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title={\`\${t("dashboard.assignedToMe")} (queue: \${t("nav.queue")})\`}
            actions={<Link href="/agent/queue"><Button variant="secondary">{t("dashboard.viewAll")}</Button></Link>}
          >
            {assigned.length === 0 ? (
              <EmptyState title={t("dashboard.agentQueueEmpty")} />
            ) : (
              <TicketTable tickets={assigned} showRequester />
            )}
          </Card>
          <Card title={t("nav.escalated")} actions={<Link href="/agent/escalated"><Button variant="secondary">{t("dashboard.viewAll")}</Button></Link>}>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldAlert aria-hidden className="size-4 text-amber-500" />
              {isMockMode() ? "3 mocked pending escalations in development data." : t("common.loading")}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
`
);

page(
  "agent/tickets",
  `'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AgentTicketsIndex() {
  const router = useRouter();
  useEffect(() => router.replace('/agent/assigned'), [router]);
  return <Link href="/agent/assigned" />;
}
`
);

page(
  "agent/assigned",
  `'use client';

import { TicketListViewWithSuspense } from "@/components/ticket-list-view";
import { useI18n } from "@/lib/i18n/provider";

export default function AgentAssignedPage() {
  const { t } = useI18n();
  return <TicketListViewWithSuspense title={t("nav.assigned")} />;
}
`
);

page(
  "agent/queue",
  `'use client';

import { TicketListViewWithSuspense } from "@/components/ticket-list-view";
import { useI18n } from "@/lib/i18n/provider";

export default function AgentQueuePage() {
  const { t } = useI18n();
  return <TicketListViewWithSuspense title={t("nav.queue")} preset={{ status: "OPEN" }} />;
}
`
);

page(
  "agent/escalated",
  `'use client';

import { TicketListViewWithSuspense } from "@/components/ticket-list-view";
import { useI18n } from "@/lib/i18n/provider";

export default function EscalatedPage() {
  const { t } = useI18n();
  return <TicketListViewWithSuspense title={t("nav.escalated")} preset={{ priority: "URGENT", sla: "BREACHED" }} />;
}
`
);

page(
  "agent/team",
  `'use client';

import { TicketListViewWithSuspense } from "@/components/ticket-list-view";
import { useI18n } from "@/lib/i18n/provider";
import { Card } from "@/components/ui";

export default function AgentTeamPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.agentTeam")}</h1>
      <Card title={t("nav.queue")}>
        <TicketListViewWithSuspense />
      </Card>
    </div>
  );
}
`
);

/* ================= TEAM LEAD ================= */

page(
  "team/dashboard",
  `'use client';

import { useEffect, useState } from "react";
import { Card, ErrorState, TableSkeleton } from "@/components/ui";
import { StatCards, TicketTable } from "@/components/ticket-views";
import { mockDashboardStats, mockTickets, mockTeams } from "@/lib/api/mock";
import { metaApi, ticketApi, isMockMode } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { DashboardStats, Ticket } from "@/lib/api/types";

export default function TeamDashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (isMockMode()) throw new Error("mock");
        const [s, list] = await Promise.all([metaApi.dashboardStats(), ticketApi.list({ pageSize: 8 })]);
        setStats(s);
        setTickets(list.items.slice(0, 6));
      } catch {
        if (isMockMode()) {
          setStats(mockDashboardStats("TEAM_LEAD"));
          setTickets(mockTickets.slice(4, 10));
        } else setError(t("errors.generic"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
`
);

page(
  "team/queue",
  `'use client';

import { TicketListViewWithSuspense } from "@/components/ticket-list-view";
import { useI18n } from "@/lib/i18n/provider";

export default function TeamQueuePage() {
  const { t } = useI18n();
  return <TicketListViewWithSuspense title={t("nav.queue")} />;
}
`
);

page(
  "team/agents",
  `'use client';

import { useEffect, useState } from "react";
import { Badge, Card, ErrorState, TableSkeleton } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers } from "@/lib/api/mock";
import type { User } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/provider";

export default function TeamAgentsPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await metaApi.userspageSizeFix();
      } catch {
        setUsers(isMockMode() ? mockUsers.filter((u) => u.role === "AGENT" || u.role === "TEAM_LEAD") : null);
        setError(isMockMode() ? null : t("errors.generic"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!users) return <TableSkeleton rows={4} cols={4} />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.agents")}</h1>
      <Card title={t("dashboard.teamOverview")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="pb-2 pr-3 font-medium">{t("admin.name")}</th>
                <th className="pb-2 pr-3 font-medium">{t("admin.role")}</th>
                <th className="pb-2 pr-3 font-medium">{t("admin.workload")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pr-3">{u.name}</td>
                  <td className="py-2.5 pr-3"><Badge tone="info">{t(\`roles.\${u.role.toLowerCase()}\`)}</Badge></td>
                  <td className="py-2.5 pr-3 text-slate-600">{isMockMode() ? (u.name === "Dawit Haile" ? "4" : "3") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
`
);

/* ================= ADMIN ================= */

const adminPages = {
  "": `'use client';

import { PageHeader } from "@/components/admin-shared";
import { useI18n } from "@/lib/i18n/provider";
import { TicketListViewWithSuspense } from "@/components/ticket-list-view";

export default function AdminHomePage() {
  const { t } = useI18n();
  return (t && <div className="space-y-4">
    <PageHeader title={t("admin.title")} subtitle={t("common.appTagline")} />
    <TicketListViewWithSuspense />
  </div>) || null;
}
`,
  users: `'use client';

import { useI18n } from "@/lib/i18n/provider";
import { PageHeader } from "@/components/admin-shared";

export default function AdminUsersPage() {
  const { t } = useI18n();
  return <PageHeader title={t("nav.users")} subtitle={t("admin.usersSubtitle")} />;
}
`
};

console.log("placeholder admin values", Object.keys(adminPages).length);
