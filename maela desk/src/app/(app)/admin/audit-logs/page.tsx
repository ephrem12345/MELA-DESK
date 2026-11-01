'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Card, ErrorState, Input, TableSkeleton } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockAuditLogs } from "@/lib/api/mock";
import type { AuditLogEntry } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


export default function AdminAuditLogsPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await metaApi.auditLogs({ pageSize: 25 });
        setLogs(res.items);
      } catch {
        if (isMockMode()) setLogs(mockAuditLogs());
        else setError(t("errors.generic"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("nav.auditLogs")}
        actions={<Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="w-56" aria-label={t("common.search")} />}
      />
      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={5} cols={4} />}
      {!loading && !error && (
        <Card>
          <DataTable
            headers={[t("admin.timestamp"), t("admin.actor"), t("admin.action"), t("admin.resource"), t("admin.resourceId"), t("common.actions")]}
            rows={logs
              .filter((l) => !q || (l.actor + l.action + l.resourceId).toLowerCase().includes(q.toLowerCase()))
              .map((l) => [
              formatDate(l.timestamp),
              l.actor,
              <span key={l.id} className="font-mono text-xs">{l.action}</span>,
              l.resourceType,
              l.resourceId,
              <span key={l.id + "-c"} className="text-xs text-slate-400">{l.changes ?? ""}</span>,
            ])}
          />
        </Card>
      )}
      <p className="text-xs text-slate-400">Audit history is read-only in the frontend; edits and deletions are enforced (and prohibited) server-side.</p>
    </div>
  );
}
