"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUp,
  Download,
  History,
  Lock,
  Paperclip,
  RefreshCw,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  TableSkeleton,
  Textarea,
  useToast,
} from "@/components/ui";
import { PriorityBadge, SlaBadge, StatusBadge } from "@/components/status-badges";
import { ticketApi, metaApi, attachmentApi, ApiError, isMockMode } from "@/lib/api/client";
import type { Role, TicketDetail } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/provider";
import { useSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { isStaff } from "@/lib/permissions";

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { t, locale } = useI18n();
  const { user } = useSession();
  const toast = useToast();

  const role: Role = user?.role ?? "REQUESTER";
  const staff = isStaff(role);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [draft, setDraft] = useState("");
  const [modeConfirm, setModeConfirm] = useState<null | "reply" | "note">(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentTeams, setAssignmentTeams] = useState<{ id: string; name: string }[]>([]);
  const [assignmentAgents, setAssignmentAgents] = useState<{ id: string; name: string }[]>([]);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignAgentId, setAssignAgentId] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    summary: "",
    code: "",
    rootCause: "",
    correctiveAction: "",
    preventiveAction: "",
    publicExplanation: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isMockMode()) {
        const d = await ticketApi.detail(id);
        if (!d) {
          setError(t("errors.generic"));
          return;
        }
        setTicket(d);
        return;
      }
      setTicket(await ticketApi.detail(id));
    } catch (e) {
      if (e instanceof ApiError && e.code !== "SERVER") setError(t(`errors.${e.code === "NOT_FOUND" ? "generic" : e.message}`));
      else setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }, [id, role, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!assignOpen) return;
    let active = true;
    setAssignmentLoading(true);
    void Promise.all([metaApi.teams({ pageSize: 100 }), metaApi.users({ pageSize: 100 })])
      .then(([teamResult, userResult]) => {
        if (!active) return;
        const teams = teamResult.items.map((team) => ({ id: team.id, name: team.name }));
        const agents = userResult.items.filter((candidate) => candidate.role === "AGENT" || candidate.role === "TEAM_LEAD").map((candidate) => ({ id: candidate.id, name: candidate.name }));
        setAssignmentTeams(teams);
        setAssignmentAgents(agents);
        setAssignTeamId(teams.find((team) => team.name === ticket?.assignedTeam)?.id ?? "");
        setAssignAgentId(ticket?.assignedAgent?.id ?? "");
      })
      .catch(() => {
        if (active) toast.push("error", t("errors.generic"));
      })
      .finally(() => {
        if (active) setAssignmentLoading(false);
      });
    return () => { active = false; };
  }, [assignOpen, ticket?.assignedTeam, ticket?.assignedAgent?.id, t, toast]);

  const mutate = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      toast.push("error", e instanceof ApiError && e.code === "FORBIDDEN" ? t("errors.unauthorized") : t("errors.generic"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-96" />
        <TableSkeleton rows={5} cols={4} />
      </div>
    );
  }
  if (error || !ticket) {
    return <ErrorState message={error ?? t("errors.generic")} onRetry={load} />;
  }

  const canReply = true; // requesters can reply to their own ticket
  const sendMessage = async () => {
    if (!draft.trim()) return;
    const ok =
      await mutate(() =>
        mode === "reply" ? ticketApi.reply(id, draft, []) : ticketApi.internalNote(id, draft, [])
      );
    if (ok) {
      setDraft("");
      toast.push("success", t(mode === "reply" ? "ticket.sendReply" : "ticket.addNote"));
    }
  };

  const switchMode = (target: "reply" | "note") => {
    if (target === mode) return;
    if (draft.trim()) setModeConfirm(target);
    else setMode(target);
  };

  const visibleMessages = ticket.messages.filter((m) => !m.isInternal || staff);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-blue-700">{ticket.ticketNumber}</p>
            <h1 className="text-lg font-semibold text-slate-900">{ticket.subject}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <SlaBadge indicator={ticket.slaIndicator} dueAt={ticket.slaDueAt} />
              <Badge tone="neutral">
                {locale === "am" ? ticket.category.labelAm : ticket.category.labelEn}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label={t("ticket.fields.status")}
              value={ticket.status}
              disabled={!staff || busy}
              onChange={(e) => mutate(() => ticketApi.updateStatus(id, e.target.value))}
              className="w-40"
            >
              {(["OPEN", "IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"] as const).map((s) => (
                <option key={s} value={s}>{t(`status.${s.toLowerCase()}`)}</option>
              ))}
            </Select>
            <Select
              aria-label={t("ticket.fields.priority")}
              value={ticket.priority}
              disabled={!staff || busy}
              onChange={(e) => mutate(() => ticketApi.updatePriority(id, e.target.value))}
              className="w-32"
            >
              {(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((p) => (
                <option key={p} value={p}>{t(`priority.${p.toLowerCase()}`)}</option>
              ))}
            </Select>
            {staff && (
              <Button variant="secondary" onClick={() => setAssignOpen(true)} loading={busy}>
                {t("ticket.assignTo")}
              </Button>
            )}
            {staff && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
              <Button variant="success" onClick={() => setResolveOpen(true)}>
                {t("ticket.resolveTicket")}
              </Button>
            )}
            {!staff && ticket.status === "RESOLVED" && (
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => mutate(() => ticketApi.reopen(id)).then((ok) => ok && toast.push("success", t("ticket.reopen")))}
              >
                {t("ticket.reopen")}
              </Button>
            )}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-slate-400">{t("ticket.fields.requester")}</dt>
            <dd className="text-slate-700">{staff ? ticket.requesterEmail : ticket.requester.name}</dd>
          </div>
          <div>
            <dt className="text-slate-400">{t("ticket.fields.team")}</dt>
            <dd className="text-slate-700">{ticket.assignedTeam ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">{t("ticket.fields.agent")}</dt>
            <dd className="text-slate-700">{ticket.assignedAgent?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">{t("ticket.fields.createdAt")}</dt>
            <dd className="text-slate-700">{formatDate(ticket.createdAt, locale)}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Description */}
          <Card title={t("ticket.fields.description")}>
            <p className="whitespace-pre-line text-sm text-slate-700">{ticket.description}</p>
          </Card>

          {/* Conversation */}
          <Card title={t("ticket.conversation")}>
            {visibleMessages.length === 0 ? (
              <EmptyState title={t("ticket.noConversation")} />
            ) : (
              <ol className="space-y-3">
                {visibleMessages.map((m) => (
                  <li
                    key={m.id}
                    className={
                      m.isInternal
                        ? "rounded-md border border-dashed border-amber-300 bg-amber-50/60 p-3"
                        : "rounded-md border border-slate-100 bg-white p-3"
                    }
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-slate-700">{m.authorName}</span>
                      {m.isInternal && (
                        <Badge tone="warning">
                          <Lock aria-hidden className="size-3" /> {t("ticket.internalBadge")}
                        </Badge>
                      )}
                      <span className="text-slate-400">{formatDate(m.createdAt, locale)}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">{m.body}</p>
                  </li>
                ))}
              </ol>
            )}

            {canReply && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                {staff && (
                  <div className="mb-2 flex gap-1 rounded-md border border-slate-200 p-1 text-xs" role="tablist">
                    <button
                      role="tab"
                      aria-selected={mode === "reply"}
                      className={`rounded px-3 py-1.5 ${mode === "reply" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                      onClick={() => switchMode("reply")}
                    >
                      {t("ticket.publicReply")}
                    </button>
                    <button
                      role="tab"
                      aria-selected={mode === "note"}
                      className={`rounded px-3 py-1.5 ${mode === "note" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                      onClick={() => switchMode("note")}
                    >
                      {t("ticket.internalNote")}
                    </button>
                  </div>
                )}
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={mode === "reply" ? t("ticket.replyPlaceholder") : t("ticket.notePlaceholder")}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {staff && mode === "note" ? t("ticket.internalBadge") : t("ticket.publicReply")}
                  </span>
                  <Button
                    loading={busy}
                    onClick={sendMessage}
                    disabled={!draft.trim()}
                    variant={mode === "note" ? "danger" : "primary"}
                  >
                    {mode === "reply" ? t("ticket.sendReply") : t("ticket.addNote")}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* Attachments */}
          <Card title={t("ticket.attachments")}>
            {ticket.attachments.length === 0 ? (
              <p className="text-xs text-slate-400">{t("ticket.noAttachments")}</p>
            ) : (
              <ul className="space-y-2">
                {ticket.attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2.5 py-2 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Paperclip aria-hidden className="size-3.5 text-slate-400" />
                      {a.fileName}
                    </span>
                    {isMockMode() ? (
                      <span className="text-[10px] text-slate-400" aria-label={t("ticket.mockAttachment")}>{t("ticket.mockAttachment")}</span>
                    ) : (
                      <a
                        href={attachmentApi.downloadUrl(id, a.id)}
                        className="text-blue-600 hover:underline"
                        aria-label={`${t("common.view")} ${a.fileName}`}
                        download
                      >
                        <Download aria-hidden className="size-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {ticket.resolution && (
            <Card title={t("ticket.resolutionTitle")}>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-slate-400">{t("ticket.resolutionSummary")}</dt>
                  <dd className="text-slate-700">{ticket.resolution.publicExplanation ?? ticket.resolution.summary}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t("ticket.resolutionPosted", { date: formatLocal(ticket.resolution.resolvedAt, locale) })}</dt>
                  <dd className="font-mono text-slate-600">{ticket.resolution.code}</dd>
                </div>
                {staff && (
                  <>
                    <div>
                      <dt className="text-slate-400">{t("ticket.rootCause")}</dt>
                      <dd className="text-slate-700">{ticket.resolution.rootCause}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">{t("ticket.correctiveAction")}</dt>
                      <dd className="text-slate-700">{ticket.resolution.correctiveAction}</dd>
                    </div>
                  </>
                )}
              </dl>
            </Card>
          )}

          <Card title={<span className="flex items-center gap-1.5 text-sm font-semibold"><History aria-hidden className="size-3.5" /> {t("nav.auditLogs")}</span>}>
            <ol className="space-y-2.5 text-xs">
              {ticket.history.map((h) => (
                <li key={h.id} className="flex gap-2">
                  <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-blue-500" />
                  <span className="text-slate-600">
                    <strong className="text-slate-800">{h.actorName}</strong>{" "}
                    {h.field}: {h.fromValue ?? "∅"} → <strong>{h.toValue ?? "∅"}</strong>
                    <span className="block text-slate-400">{formatDate(h.createdAt, locale)}</span>
                  </span>
                </li>
              ))}
          </ol>
          </Card>
        </div>
      </div>

      {/* Assignment dialog */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} title={t("ticket.assignTo")} size="sm">
        <Field label={t("ticket.fields.team")} htmlFor="assign-team">
          <Select id="assign-team" value={assignTeamId} onChange={(event) => setAssignTeamId(event.target.value)} disabled={assignmentLoading || busy}>
            <option value="">—</option>
            {assignmentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </Field>
        <Field label={t("ticket.fields.agent")} htmlFor="assign-agent">
          <Select id="assign-agent" value={assignAgentId} onChange={(event) => setAssignAgentId(event.target.value)} disabled={assignmentLoading || busy}>
            <option value="">—</option>
            {assignmentAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </Select>
        </Field>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAssignOpen(false)}>{t("common.cancel")}</Button>
          <Button
            loading={busy || assignmentLoading}
            onClick={async () => {
              const ok = await mutate(() =>
                ticketApi.assign(id, {
                  teamId: assignTeamId || undefined,
                  agentId: assignAgentId || undefined,
                })
              );
              if (ok) {
                setAssignOpen(false);
                toast.push("success", t("ticket.assignTo"));
              }
            }}
          >
            {t("common.confirm")}
          </Button>
        </div>
      </Dialog>

      {/* Resolution dialog */}
      <Dialog open={resolveOpen} onClose={() => setResolveOpen(false)} title={t("ticket.resolveTicket")} size="lg">
        <div className="grid gap-3">
          <Field label={t("ticket.resolutionSummary")} required>
            <Textarea value={resolveForm.summary} onChange={(e) => setResolveForm({ ...resolveForm, summary: e.target.value })} />
          </Field>
          <Field label={t("ticket.resolutionCode")} required>
            <Input value={resolveForm.code} onChange={(e) => setResolveForm({ ...resolveForm, code: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("ticket.rootCause")}>
              <Textarea value={resolveForm.rootCause} onChange={(e) => setResolveForm({ ...resolveForm, rootCause: e.target.value })} />
            </Field>
            <Field label={t("ticket.correctiveAction")}>
              <Textarea value={resolveForm.correctiveAction} onChange={(e) => setResolveForm({ ...resolveForm, correctiveAction: e.target.value })} />
            </Field>
          </div>
          <Field label={t("ticket.preventiveAction")}>
            <Textarea value={resolveForm.preventiveAction} onChange={(e) => setResolveForm({ ...resolveForm, preventiveAction: e.target.value })} />
          </Field>
          <Field label={`${t("ticket.resolutionSummary")} — ${t("nav.notifications")}`} hint="Customer-facing explanation">
            <Textarea value={resolveForm.publicExplanation} onChange={(e) => setResolveForm({ ...resolveForm, publicExplanation: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResolveOpen(false)}>{t("common.cancel")}</Button>
          <Button
            variant="success"
            loading={busy}
            onClick={async () => {
              if (!resolveForm.summary || !resolveForm.code) {
                toast.push("error", t("errors.validated"));
                return;
              }
              const ok = await mutate(() => ticketApi.resolve(id, { ...resolveForm }));
              if (ok) {
                setResolveOpen(false);
                toast.push("success", t("ticket.resolveTicket"));
              }
            }}
          >
            {t("ticket.resolveTicket")}
          </Button>
        </div>
      </Dialog>

      {/* Mode-switch confirmation */}
      <ConfirmDialog
        open={modeConfirm !== null}
        onClose={() => setModeConfirm(null)}
        title={t("common.confirmTitle")}
        body={t("ticket.switchModeConfirm", {
          target: modeConfirm === "note" ? t("ticket.internalBadge") : t("ticket.publicReply"),
        })}
        confirmLabel={t("common.confirm")}
        onConfirm={() => {
          setModeConfirm(null);
          if (modeConfirm) setMode(modeConfirm);
        }}
      />
    </div>
  );
}

function formatLocal(value: string | null, locale: string) {
  if (!value) return "—";
  return formatDate(value, locale);
}
