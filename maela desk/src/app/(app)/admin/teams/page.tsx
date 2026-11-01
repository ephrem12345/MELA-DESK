'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


export default function AdminTeamsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [teams, setTeams] = useState<typeof mockTeams>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    void metaApi.teams({ pageSize: 100 }).then((result) => {
      setTeams(result.items.map((team) => ({ id: team.id, name: team.name, lead: (team as typeof team & { lead?: string }).lead ?? "Unassigned", openTickets: (team as typeof team & { openTickets?: number }).openTickets ?? 0, active: team.active })));
    }).catch(() => {
      if (isMockMode()) setTeams(mockTeams);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.teams")} actions={<Button onClick={() => setAddOpen(true)}>{t("admin.addTeam")}</Button>} />
      {loading && <TableSkeleton rows={3} cols={3} />}
      {!loading && (
        <Card>
          <DataTable
            headers={[t("admin.teamName"), t("admin.teamLead"), t("admin.workload"), t("admin.accountStatus")]}
            rows={teams.map((tm) => [tm.name, tm.lead, String(tm.openTickets), <Badge key={tm.id} tone={tm.active ? "success" : "danger"}>{tm.active ? t("admin.active") : t("admin.inactive")}</Badge>])}
          />
        </Card>
      )}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title={t("admin.addTeam")} size="sm">
        <Field label={t("admin.teamName")} required><Input value={name} onChange={(e) => setName(e.target.value)} id="team-name" /></Field>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAddOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={async () => {
            if (!name.trim()) { toast.push("error", t("errors.validated")); return; }
            try {
              if (isMockMode()) {
                setTeams((prev) => [...prev, { id: "t-new-" + Date.now(), name: name.trim(), lead: "Unassigned", openTickets: 0, active: true }]);
                toast.push("info", "Development mode: team changes are local to this browser.");
              } else {
                const { team } = await metaApi.createTeam({ name: name.trim() });
                setTeams((prev) => [...prev, { id: team.id, name: team.name, lead: "Unassigned", openTickets: 0, active: team.active }]);
                toast.push("success", t("admin.addTeam"));
              }
              setName("");
              setAddOpen(false);
            } catch {
              toast.push("error", t("errors.generic"));
            }
          }}>{t("common.confirm")}</Button>
        </div>
      </Dialog>
    </div>
  );
}
