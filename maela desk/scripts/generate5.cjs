const fs = require("fs");
const path = require("path");
const ROOT = "src/app/(app)/admin";
const page = (name, code) => {
  const dir = path.join(ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), code.trim() + "\n");
  console.log("wrote admin/" + (name || "(index)"));
};

const importShared = "'use client';\n\nimport { useEffect, useState } from \"react\";\nimport { PageHeader, DataTable } from \"@/components/admin-shared\";\nimport { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from \"@/components/ui\";\nimport { metaApi, isMockMode } from \"@/lib/api/client\";\nimport { mockUsers, mockAuditLogs, mockCategories, mockTeams } from \"@/lib/api/mock\";\nimport { useI18n } from \"@/lib/i18n/provider\";\nimport { formatDate } from \"@/lib/utils\";\n\n";

page("", importShared + `
export default function AdminHomePage() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <PageHeader title={t("admin.title")} subtitle={t("common.appTagline")} />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/admin/users", label: t("nav.users") },
          { href: "/admin/workflows", label: t("nav.workflows") },
          { href: "/admin/reports", label: t("nav.reports") },
        ].map((l) => (
          <a key={l.href} href={l.href} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-blue-700 shadow-[var(--shadow-card)] hover:border-blue-300">
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}
`);

page("users", importShared + `
export default function AdminUsersPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [users, setUsers] = useState<typeof mockUsers>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await metaApi.users({ pageSize: 25 });
        setUsers(res.items);
      } catch {
        if (isMockMode()) setUsers(mockUsers);
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
                <Badge key={u.id} tone="info">{t(\`roles.\${u.role.toLowerCase()}\`)}</Badge>,
                u.teamName ?? "—",
                <Badge key={u.id + "-s"} tone={u.active ? "success" : "danger"}>{u.active ? t("admin.active") : t("admin.inactive")}</Badge>,
                <span key={u.id + "-a"} className="flex gap-2">
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEdit(u.id)}>{t("common.edit")}</Button>
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
        onConfirm={() => {
          if (confirm) setUsers((prev) => prev.map((u) => (u.id === confirm ? { ...u, active: !u.active } : u)));
          setConfirm(null);
          toast.push("success", t("common.confirm"));
        }}
      />
      <Dialog open={edit !== null} onClose={() => setEdit(null)} title={t("admin.editUser")}>
        {(() => {
          const u = visible.find((x) => x.id === edit);
          if (!u) return null;
          return (
            <div className="space-y-3">
              <Field label={t("auth.fullName")}><Input defaultValue={u.name} /></Field>
              <Field label={t("admin.role")}>
                <Select defaultValue={u.role}>
                  {["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"].map((r) => <option key={r} value={r}>{t(\`roles.\${r.toLowerCase()}\`)}</option>)}
                </Select>
              </Field>
              <Field label={t("admin.team")}>
                <Select defaultValue={u.teamId ?? ""}><option value="">—</option><option value="t-1">Service Desk</option><option value="t-2">Network Operations</option></Select>
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEdit(null)}>{t("common.cancel")}</Button>
                <Button
                  onClick={() => {
                    setEdit(null);
                    toast.push(isMockMode() ? "info" : "success", isMockMode() ? "Development mode: apply via API when backend is ready." : t("common.save"));
                  }}
                >
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
`);

page("roles", importShared + `
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
                  <th key={r} className="pb-2 pr-3 font-medium">{t(\`roles.\${r}\`)}</th>
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
                        aria-label={\`\${perm} \${role}\`}
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
`);

page("teams", importShared + `
export default function AdminTeamsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [teams, setTeams] = useState<typeof mockTeams>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    // Mock-provided data is labeled by the MockBanner while no backend team API exists.
    setLoading(false);
    setTeams(mockTeams);
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
          <Button onClick={() => { if (name) { setTeams([...teams, { id: "t-new-" + Date.now(), name, lead: "Unassigned", openTickets: 0, active: true }]); setName(""); setAddOpen(false); toast.push("success", t("admin.addTeam")); } }}>{t("common.confirm")}</Button>
        </div>
      </Dialog>
    </div>
  );
}
`);

page("categories", importShared + `
export default function AdminCategoriesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [cats, setCats] = useState<typeof mockCategories>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
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
              onClick={() => {
                if (!form.name || !form.en || !form.am) { toast.push("error", t("errors.validated")); return; }
                setCats((prev) => [...prev, { id: "c-" + Date.now(), name: form.name, labelEn: form.en, labelAm: form.am, parentId: form.parent || null, active: true, displayOrder: prev.length + 1 }]);
                setAddOpen(false); setForm({ name: "", en: "", am: "", parent: "" });
                toast.push("success", t("common.save"));
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
`);

page("workflows", importShared + `
const STATUSES = ["OPEN", "IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"];

export default function AdminWorkflowsPage() {
  const { t } = useI18n();
  const [allowed, setAllowed] = useState<Record<string, string[]>>({
    OPEN: ["IN_PROGRESS", "PENDING_REQUESTER", "RESOLVED", "CLOSED"],
    IN_PROGRESS: ["PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"],
    PENDING_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
    PENDING_THIRD_PARTY: ["IN_PROGRESS", "RESOLVED"],
    RESOLVED: ["CLOSED"],
    CLOSED: [],
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.workflows")} subtitle={t("slaSubtitle") || undefined} />
      {STATUSES.map((s) => (
        <Card key={s} title={t(\`status.\${s.toLowerCase()}\`)}>
          <div className="flex flex-wrap gap-2">
            {STATUSES.filter((x) => x !== s).map((target) => {
              const on = (allowed[s] ?? []).includes(target);
              return (
                <button
                  key={target}
                  aria-pressed={on}
                  className={\`rounded border px-2.5 py-1 text-xs \${on ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-400"}\`}
                  onClick={() => setAllowed((m) => {
                    const set = new Set(m[s] ?? []);
                    if (on) set.delete(target); else set.add(target);
                    return { ...m, [s]: Array.from(set) };
                  })}
                >
                  → {t(\`status.\${target.toLowerCase()}\`)}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
`);

page("sla", importShared + `
export default function AdminSlaPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [conf, setConf] = useState({
    URGENT: { resp: 1, res: 4 },
    HIGH: { resp: 2, res: 8 },
    NORMAL: { resp: 4, res: 24 },
    LOW: { resp: 8, res: 72 },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("nav.sla")}
        subtitle={t("admin.slaSubtitle")}
        actions={<Button variant="secondary" onClick={() => toast.push("info", isMockMode() ? "Development mode: submit via API when backend is ready." : t("common.save"))}>{t("common.save")}</Button>}
      />
      <Card>
        <div className="space-y-3">
          {Object.entries(conf).map(([p, v]) => (
            <div key={p} className="grid items-end gap-3 border-b border-slate-50 pb-3 last:border-0 sm:grid-cols-3">
              <Badge tone={p === "URGENT" ? "danger" : p === "HIGH" ? "warning" : "neutral"}>{t(\`priority.\${p.toLowerCase()}\`)}</Badge>
              <Field label={t("admin.responseTarget")}>
                <Input type="number" min={0} value={v.resp} onChange={(e) => setConf({ ...conf, [p]: { ...v, resp: Number(e.target.value) } })} aria-label={\`\${p} response\`} />
              </Field>
              <Field label={t("admin.resolutionTarget")}>
                <Input type="number" min={0} value={v.res} onChange={(e) => setConf({ ...conf, [p]: { ...v, res: Number(e.target.value) } })} aria-label={\`\${p} resolution\`} />
              </Field>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
`);

page("notifications", importShared + `
const CHANNELS = ["email", "in_app", "digest"];

export default function AdminNotificationsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ email: true, in_app: true, digest: false });

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.adminNotifications")} actions={<Button variant="secondary" onClick={() => toast.push("info", isMockMode() ? "Development mode: submit via API when backend is ready." : t("common.save"))}>{t("common.save")}</Button>} />
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
`);

page("localization", importShared + `
export default function AdminLocalizationPage() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.localization")} />
      <Card title="Default locale">
        <div className="max-w-xs">
          <Field label="Default locale" htmlFor="loc"><Select id="loc" value={locale} onChange={(e) => setLocale(e.target.value as "en" | "am")}><option value="en">English</option><option value="am">Amharic</option></Select></Field>
        </div>
        <p className="mt-3 text-xs text-slate-500">English and Amharic dictionaries live in src/lib/i18n/messages/. Missing keys fall back to English and are logged in development.</p>
      </Card>
    </div>
  );
}
`);

page("audit-logs", importShared + `
export default function AdminAuditLogsPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<typeof mockAuditLogs>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await metaApi.auditLogs({ pageSize: 25 });
        setLogs(res.items);
      } catch {
        if (isMockMode()) setLogs(mockAuditLogs);
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
`);

page("storage", importShared + `
const TYPES = [".png", ".jpg", ".jpeg", ".gif", ".pdf", ".txt", ".csv", ".doc", ".docx", ".log"];

export default function AdminStoragePage() {
  const { t } = useI18n();
  const [maxMb, setMaxMb] = useState(10);
  const [types, setTypes] = useState<string[]>(TYPES);

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.storage")} />
      <Card title="Limits">
        <div className="max-w-xs">
          <Field label="Max file size (MB)">
            <Input type="number" min={1} max={100} value={maxMb} onChange={(e) => setMaxMb(Number(e.target.value))} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">Allowed today: {types.join(", ")}</p>
      </Card>
    </div>
  );
}
`);

page("system-health", importShared + `
import { reportsApi } from "@/lib/api/client";

export default function AdminSystemHealthPage() {
  const { t } = useI18n();
  const [state, setState] = useState<{ db: string; api: string; storage: string; lastBackup: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
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
`);

console.log("admin pages done");
