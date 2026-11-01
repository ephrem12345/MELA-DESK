'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


const CHANNELS = ["email", "in_app", "digest"];

export default function AdminNotificationsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ email: true, in_app: true, digest: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isMockMode()) return;
    void metaApi.settings().then(({ items }) => {
      const values = new Map(items.map((item) => [item.key, item.value]));
      setPrefs({
        email: values.get("notifications.email") !== false,
        in_app: values.get("notifications.in_app") !== false,
        digest: values.get("notifications.digest") === true,
      });
    }).catch(() => toast.push("error", t("errors.generic")));
  }, [t, toast]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.adminNotifications")} actions={<Button variant="secondary" loading={saving} onClick={async () => {
        if (isMockMode()) { toast.push("info", "Development mode: notification settings are local only."); return; }
        setSaving(true);
        try {
          await metaApi.updateSettings({
            "notifications.email": prefs.email,
            "notifications.in_app": prefs.in_app,
            "notifications.digest": prefs.digest,
          });
          toast.push("success", t("common.save"));
        } catch {
          toast.push("error", t("errors.generic"));
        } finally {
          setSaving(false);
        }
      }}>{t("common.save")}</Button>} />
      <Card>
        <div className="space-y-3">
          {CHANNELS.map((c) => (
            <label key={c} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-sm">
              <span className="cap-first text-slate-700">{c}</span>
              <input type="checkbox" className="size-4" checked={prefs[c] ?? false} onChange={(e) => setPrefs({ ...prefs, [c]: e.target.checked })} aria-label={c} />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
