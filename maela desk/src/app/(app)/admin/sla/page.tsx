'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


export default function AdminSlaPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [policyIds, setPolicyIds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [conf, setConf] = useState({
    URGENT: { resp: 1, res: 4 },
    HIGH: { resp: 2, res: 8 },
    NORMAL: { resp: 4, res: 24 },
    LOW: { resp: 8, res: 72 },
  });

  useEffect(() => {
    if (isMockMode()) return;
    void metaApi.slaPolicies().then(({ items }) => {
      const nextConf = { ...conf };
      const nextIds: Record<string, string> = {};
      for (const policy of items) {
        if (!(policy.priority in nextConf)) continue;
        nextIds[policy.priority] = policy.priorityId;
        nextConf[policy.priority as keyof typeof nextConf] = {
          resp: Math.max(1, Math.round(policy.firstResponseMinutes / 60)),
          res: Math.max(1, Math.round(policy.resolutionMinutes / 60)),
        };
      }
      setConf(nextConf);
      setPolicyIds(nextIds);
    }).catch(() => toast.push("error", t("errors.generic")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("nav.sla")}
        subtitle={t("admin.slaSubtitle")}
        actions={<Button variant="secondary" loading={saving} onClick={async () => {
          if (isMockMode()) { toast.push("info", "Development mode: SLA changes are local only."); return; }
          setSaving(true);
          try {
            await Promise.all(Object.entries(conf).map(([priority, value]) => {
              const id = policyIds[priority];
              if (!id) throw new Error("Missing SLA priority mapping");
              return metaApi.updatePriority(id, { firstResponseMinutes: Math.max(1, value.resp) * 60, resolutionMinutes: Math.max(1, value.res) * 60 });
            }));
            toast.push("success", t("common.save"));
          } catch {
            toast.push("error", t("errors.generic"));
          } finally {
            setSaving(false);
          }
        }}>{t("common.save")}</Button>}
      />
      <Card>
        <div className="space-y-3">
          {Object.entries(conf).map(([p, v]) => (
            <div key={p} className="grid items-end gap-3 border-b border-slate-50 pb-3 last:border-0 sm:grid-cols-3">
              <Badge tone={p === "URGENT" ? "danger" : p === "HIGH" ? "warning" : "neutral"}>{t(`priority.${p.toLowerCase()}`)}</Badge>
              <Field label={t("admin.responseTarget")}>
                <Input type="number" min={0} value={v.resp} onChange={(e) => setConf({ ...conf, [p]: { ...v, resp: Number(e.target.value) } })} aria-label={`${p} response`} />
              </Field>
              <Field label={t("admin.resolutionTarget")}>
                <Input type="number" min={0} value={v.res} onChange={(e) => setConf({ ...conf, [p]: { ...v, res: Number(e.target.value) } })} aria-label={`${p} resolution`} />
              </Field>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
