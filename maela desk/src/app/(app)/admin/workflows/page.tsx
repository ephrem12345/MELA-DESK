'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


const STATUSES = ["OPEN", "IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"];

export default function AdminWorkflowsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState<Record<string, string[]>>({
    OPEN: ["IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "CLOSED"],
    IN_PROGRESS: ["PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"],
    PENDING_REQUESTER: ["IN_PROGRESS", "CLOSED"],
    PENDING_THIRD_PARTY: ["IN_PROGRESS", "CLOSED"],
    RESOLVED: ["IN_PROGRESS", "CLOSED"],
    CLOSED: ["OPEN"],
  });

  useEffect(() => {
    if (isMockMode()) return;
    void metaApi.workflow().then((result) => setAllowed(result.transitions)).catch(() => toast.push("error", t("errors.generic")));
  }, [t, toast]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.workflows")} subtitle={t("slaSubtitle") || undefined} actions={<Button loading={saving} onClick={async () => {
        if (isMockMode()) { toast.push("info", "Development mode: workflow changes are local only."); return; }
        setSaving(true);
        try {
          const result = await metaApi.updateWorkflow(allowed);
          setAllowed(result.transitions);
          toast.push("success", t("common.save"));
        } catch {
          toast.push("error", t("errors.generic"));
        } finally {
          setSaving(false);
        }
      }}>{t("common.save")}</Button>} />
      {STATUSES.map((s) => (
        <Card key={s} title={t(`status.${s.toLowerCase()}`)}>
          <div className="flex flex-wrap gap-2">
            {STATUSES.filter((x) => x !== s).map((target) => {
              const on = (allowed[s] ?? []).includes(target);
              return (
                <button
                  key={target}
                  aria-pressed={on}
                  className={`rounded border px-2.5 py-1 text-xs ${on ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-400"}`}
                  onClick={() => setAllowed((m) => {
                    const set = new Set(m[s] ?? []);
                    if (on) set.delete(target); else set.add(target);
                    return { ...m, [s]: Array.from(set) };
                  })}
                >
                  → {t(`status.${target.toLowerCase()}`)}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
