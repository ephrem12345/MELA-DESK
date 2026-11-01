'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


export default function AdminUsersPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [users, setUsers] = useState<typeof mockUsers>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "REQUESTER", teamId: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [q, setQ] = useState("");
  const [teamOptions, setTeamOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [res, teamResult] = await Promise.all([metaApi.users({ pageSize: 25 }), metaApi.teams({ pageSize: 100 })]);
        setUsers(res.items);
        setTeamOptions(teamResult.items.map((team) => ({ id: team.id, name: team.name })));
      } catch {
        if (isMockMode()) {
          setUsers(mockUsers);
          setTeamOptions([{ id: "t-1", name: "Service Desk" }, { id: "t-2", name: "Network Operations" }]);
        }
        else setError(t("errors.generic"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const visible = users.filter((u) => !q || (u.name + u.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("nav.users")}
        subtitle={t("admin.usersSubtitle")}
        actions={<Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="w-56" aria-label={t("common.search")} />}
      />
      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={5} cols={5} />}
      {!loading && !error && (
        <Card>
          {visible.length === 0 ? <EmptyState title={t("common.noResults")} /> : (
            <DataTable
              headers={[t("admin.name"), t("admin.email"), t("admin.role"), t("admin.team"), t("admin.accountStatus"), t("common.actions")]}
              rows={visible.map((u) => [
                u.name,
                u.email,
                <Badge key={u.id} tone="info">{t(`roles.${u.role.toLowerCase()}`)}</Badge>,
                u.teamName ?? "—",
                <Badge key={u.id + "-s"} tone={u.active ? "success" : "danger"}>{u.active ? t("admin.active") : t("admin.inactive")}</Badge>,
                <span key={u.id + "-a"} className="flex gap-2">
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => { setEdit(u.id); setEditForm({ name: u.name, role: u.role, teamId: u.teamId ?? "" }); }}>{t("common.edit")}</Button>
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setConfirm(u.id)}>
                    {u.active ? t("admin.deactivate") : t("admin.activate")}
                  </Button>
                </span>,
              ])}
            />
          )}
        </Card>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={t("common.confirmTitle")}
        body={isMockMode() ? "Development mode: change applied locally only." : undefined}
        danger
        onConfirm={async () => {
          const target = users.find((user) => user.id === confirm);
          if (!target || !confirm) return;
          try {
            if (isMockMode()) {
              setUsers((prev) => prev.map((user) => user.id === confirm ? { ...user, active: !user.active } : user));
              toast.push("info", "Development mode: account status changed in this browser only.");
            } else {
              const result = await metaApi.setUserActive(confirm, !target.active);
              setUsers((prev) => prev.map((user) => user.id === confirm ? { ...user, active: result.user.active } : user));
              toast.push("success", t("common.confirm"));
            }
            setConfirm(null);
          } catch {
            toast.push("error", t("errors.generic"));
          }
        }}
      />
      <Dialog open={edit !== null} onClose={() => setEdit(null)} title={t("admin.editUser")}>
        {(() => {
          const u = visible.find((x) => x.id === edit);
          if (!u) return null;
          return (
            <div className="space-y-3">
              <Field label={t("auth.fullName")}><Input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></Field>
              <Field label={t("admin.role")}>
                <Select value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}>
                  {["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"].map((r) => <option key={r} value={r}>{t(`roles.${r.toLowerCase()}`)}</option>)}
                </Select>
              </Field>
              <Field label={t("admin.team")}>
                <Select value={editForm.teamId} onChange={(event) => setEditForm({ ...editForm, teamId: event.target.value })}>
                  <option value="">—</option>
                  {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </Select>
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEdit(null)}>{t("common.cancel")}</Button>
                <Button loading={savingEdit} onClick={async () => {
                  setSavingEdit(true);
                  try {
                    if (isMockMode()) {
                      setUsers((prev) => prev.map((user) => user.id === u.id ? { ...user, name: editForm.name, role: editForm.role as typeof user.role, teamId: editForm.teamId || null, teamName: teamOptions.find((team) => team.id === editForm.teamId)?.name ?? null } : user));
                      toast.push("info", "Development mode: changes are local to this browser.");
                    } else {
                      await metaApi.updateUser(u.id, { name: editForm.name });
                      if (editForm.role !== u.role) await metaApi.setUserRole(u.id, editForm.role);
                      if (editForm.teamId !== (u.teamId ?? "")) {
                        if (u.teamId) await metaApi.removeTeamMember(u.teamId, u.id);
                        if (editForm.teamId) await metaApi.addTeamMember(editForm.teamId, { userId: u.id, membershipRole: editForm.role === "TEAM_LEAD" ? "LEAD" : "MEMBER" });
                      }
                      const refreshed = await metaApi.users({ pageSize: 25 });
                      setUsers(refreshed.items);
                      toast.push("success", t("common.save"));
                    }
                    setEdit(null);
                  } catch {
                    toast.push("error", t("errors.generic"));
                  } finally {
                    setSavingEdit(false);
                  }
                }}>
                  {t("common.save")}
                </Button>
              </div>
            </div>
          );
        })()}
      </Dialog>
    </div>
  );
}
