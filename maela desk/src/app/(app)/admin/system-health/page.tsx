'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


import { reportsApi } from "@/lib/api/client";

export default function AdminSystemHealthPage() {
  const { t } = useI18n();
  const [state, setState] = useState<{ db: string; api: string; storage: string; lastBackup: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (isMockMode()) throw new Error("mock mode");
        await reportsApi.summary({ days: 1 });
        setState({ db: "ok", api: "ok", storage: "ok", lastBackup: "—" });
      } catch {
        setState({ db: isMockMode() ? "mock" : "unknown", api: isMockMode() ? "mock" : "unreachable", storage: isMockMode() ? "mock" : "unknown", lastBackup: "—" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.systemHealth")} />
      {loading ? <TableSkeleton rows={2} cols={3} /> : (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { key: "Database", value: state?.db },
            { key: "API", value: state?.api },
            { key: "Attachments", value: state?.storage },
          ].map((s) => (
            <Card key={s.key}>
              <p className="text-xs text-slate-500">{s.key}</p>
              <p className="mt-1">
                <Badge tone={s.value === "ok" ? "success" : s.value === "mock" ? "warning" : "danger"}>
                  {s.value ?? "unknown"}
                </Badge>
              </p>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">Backup status and detailed service checks require backend health endpoints.</p>
    </div>
  );
}
