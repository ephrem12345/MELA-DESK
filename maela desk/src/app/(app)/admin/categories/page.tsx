'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


export default function AdminCategoriesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [cats, setCats] = useState<typeof mockCategories>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", en: "", am: "", parent: "" });

  useEffect(() => {
    (async () => {
      try {
        setCats(await metaApi.categories());
      } catch {
        if (isMockMode()) setCats(mockCategories);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.categories")} actions={<Button onClick={() => setAddOpen(true)}>{t("admin.categories")}</Button>} />
      {loading && <TableSkeleton rows={4} cols={4} />}
      {!loading && (
        <Card>
          <DataTable
            headers={[t("admin.categoryName"), t("admin.labelEn"), t("admin.labelAm"), t("admin.parentCategory")]}
            rows={cats.map((c) => [c.name, c.labelEn, c.labelAm, cats.find((p) => p.id === c.parentId)?.name ?? "—"])}
          />
        </Card>
      )}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title={t("nav.categories")}>
        <div className="space-y-3">
          <Field label={t("admin.categoryName")} required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t("admin.labelEn")} required><Input value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} /></Field>
          <Field label={t("admin.labelAm")} required><Input value={form.am} onChange={(e) => setForm({ ...form, am: e.target.value })} /></Field>
          <Field label={t("admin.parentCategory")}>
            <Select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}>
              <option value="">—</option>
              {cats.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.labelEn}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>{t("common.cancel")}</Button>
            <Button
              loading={saving}
              onClick={async () => {
                if (!form.name || !form.en || !form.am) { toast.push("error", t("errors.validated")); return; }
                setSaving(true);
                try {
                  if (isMockMode()) {
                    setCats((prev) => [...prev, { id: "c-" + Date.now(), name: form.name, labelEn: form.en, labelAm: form.am, parentId: form.parent || null, active: true, displayOrder: prev.length + 1 }]);
                    toast.push("info", "Development mode: category changes are local to this browser.");
                  } else {
                    const { category } = await metaApi.createCategory({ name: form.name, labelEn: form.en, labelAm: form.am, parentId: form.parent || null, displayOrder: cats.length + 1 });
                    setCats((prev) => [...prev, category]);
                    toast.push("success", t("common.save"));
                  }
                  setAddOpen(false);
                  setForm({ name: "", en: "", am: "", parent: "" });
                } catch {
                  toast.push("error", t("errors.generic"));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {t("common.confirm")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
