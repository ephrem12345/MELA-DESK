'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


const PERMS = ["tickets.view.all", "tickets.assign", "tickets.resolve", "users.manage", "settings.manage", "audit.view"] as const;

export default function AdminRolesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({
    REQUESTER: { "tickets.view.all": false, "tickets.assign": false, "tickets.resolve": false, "users.manage": false, "settings.manage": false, "audit.view": false },
    AGENT: { "tickets.view.all": true, "tickets.assign": true, "tickets.resolve": true, "users.manage": false, "settings.manage": false, "audit.view": false },
    TEAM_LEAD: { "tickets.view.all": true, "tickets.assign": true, "tickets.resolve": true, "users.manage": true, "settings.manage": false, "audit.view": true },
    ADMIN: { "tickets.view.all": true, "tickets.assign": true, "tickets.resolve": true, "users.manage": true, "settings.manage": true, "audit.view": true },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("nav.roles")}
        actions={<Button variant="secondary" onClick={() => toast.push("info", isMockMode() ? "Development mode: submit via API when backend is ready." : t("common.save"))}>{t("common.save")}</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="pb-2 pr-3 font-medium">{t("common.actions")}</th>
                {["requester", "agent", "team_lead", "admin"].map((r) => (
                  <th key={r} className="pb-2 pr-3 font-medium">{t(`roles.${r}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMS.map((perm) => (
                <tr key={perm} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-600">{perm}</td>
                  {Object.keys(matrix).map((role) => (
                    <td key={role} className="py-2 pr-3">
                      <input
                        type="checkbox"
                        className="size-4"
                        aria-label={`${perm} ${role}`}
                        checked={matrix[role][perm] ?? false}
                        onChange={(e) => setMatrix((m) => ({ ...m, [role]: { ...m[role], [perm]: e.target.checked } }))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
