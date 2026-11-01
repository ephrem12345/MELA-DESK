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
              <Badge key={u.id} tone="info">{t(`roles.${u.role.toLowerCase()}`)}</Badge>,
              u.teamName ?? "—",
              <Badge key={u.id + "-s"} tone={u.active ? "success" : "danger"}>{u.active ? t("admin.active") : t("admin.inactive")}</Badge>,
            ])}
          />
        </Card>
      )}
    </div>
  );
}
