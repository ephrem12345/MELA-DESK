"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button, Card, ErrorState, Select, TableSkeleton, EmptyState, useToast } from "@/components/ui";
import { DataTable, PageHeader } from "@/components/admin-shared";
import { BarChart, LineChart, type Datum } from "@/components/charts";
import { reportsApi, isMockMode } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

type Summary = {
  volume: { date: string; total: number }[];
  byStatus: Datum[];
  byPriority: Datum[];
  byCategory: Datum[];
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  slaCompliancePct: number | null;
  reopenRatePct: number | null;
  agentWorkload: { name: string; total: number }[];
};

export function ReportsView() {
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (isMockMode()) throw new Error("mock mode");
        const s = await reportsApi.summary({ days: Number(range) });
        if (alive) setData(s);
      } catch {
        if (alive && isMockMode()) {
          setData({
            volume: Array.from({ length: 14 }, (_, i) => ({
              date: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
              total: [2, 4, 1, 5, 3, 0, 2, 6, 3, 1, 4, 2, 5, 3][i],
            })),
            byStatus: [
              { label: t("status.open"), total: 6 },
              { label: t("status.in_progress"), total: 4 },
              { label: t("status.pending_requester"), total: 2 },
              { label: t("status.resolved"), total: 2 },
            ],
            byPriority: [
              { label: t("priority.low"), total: 3 },
              { label: t("priority.normal"), total: 6 },
              { label: t("priority.high"), total: 3 },
              { label: t("priority.urgent"), total: 2 },
            ],
            byCategory: [
              { label: t("admin.categories"), total: 5 },
              { label: "Software", total: 4 },
              { label: "Network", total: 3 },
              { label: "Email", total: 2 },
            ],
            avgFirstResponseMinutes: 42,
            avgResolutionMinutes: 1850,
            slaCompliancePct: 87.5,
            reopenRatePct: 4.2,
            agentWorkload: [
              { name: "Dawit Haile", total: 6 },
              { name: "Michael Tesfaye", total: 5 },
            ],
          });
        } else if (alive) {
          setError(t("errors.generic"));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const exportCsv = () => {
    if (!data) return;
    const lines = ["metric,value"];
    lines.push(
      `avg_first_response_minutes,${data.avgFirstResponseMinutes ?? "n/a"}`,
      `avg_resolution_minutes,${data.avgResolutionMinutes ?? "n/a"}`,
      `sla_compliance_pct,${data.slaCompliancePct ?? "n/a"}`,
      `reopen_rate_pct,${data.reopenRatePct ?? "n/a"}`
    );
    data.byStatus.forEach((d) => lines.push(`status_${d.label},${d.total}`));
    data.byPriority.forEach((d) => lines.push(`priority_${d.label},${d.total}`));
    data.agentWorkload.forEach((d) => lines.push(`agent_${d.name},${d.total}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mela-desk-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.push("info", t("reports.exportCsv"));
  };

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("nav.reports")}
        actions={
          <div className="flex gap-2">
            <Select value={range} onChange={(e) => setRange(e.target.value)} aria-label={t("admin.dateRange")} className="w-36">
              <option value="7">{`Last 7 days`}</option>
              <option value="30">{`Last 30 days`}</option>
              <option value="90">{`Last 90 days`}</option>
            </Select>
            <Button variant="secondary" onClick={exportCsv} disabled={!data}>
              <Download aria-hidden className="size-4" /> {t("reports.exportCsv")}
            </Button>
          </div>
        }
      />

      {loading && <TableSkeleton rows={6} cols={3} />}

      {!loading && data && (
        <>
          {!data.byStatus.some((d) => d.total > 0) && !data.volume.some((v) => v.total > 0) ? (
            <EmptyState title={t("reports.noData")} />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: t("reports.avgFirstResponse"), value: data.avgFirstResponseMinutes == null ? "—" : `${data.avgFirstResponseMinutes} min` },
                  { label: t("reports.avgResolution"), value: data.avgResolutionMinutes == null ? "—" : `${(data.avgResolutionMinutes / 60).toFixed(1)} h` },
                  { label: t("reports.slaCompliance"), value: data.slaCompliancePct == null ? "—" : `${data.slaCompliancePct}%` },
                  { label: t("reports.reopenRate"), value: data.reopenRatePct == null ? "—" : `${data.reopenRatePct}%` },
                ].map((s) => (
                  <Card key={s.label}>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card title={t("reports.volume")}>
                  <LineChart points={data.volume} ariaLabel={t("reports.volume")} />
                </Card>
                <Card title={t("reports.byStatus")}>
                  <BarChart data={data.byStatus} ariaLabel={t("reports.byStatus")} />
                </Card>
                <Card title={t("reports.byPriority")}>
                  <BarChart data={data.byPriority} ariaLabel={t("reports.byPriority")} color="#d97706" />
                </Card>
                <Card title={t("reports.byCategory")}>
                  <BarChart data={data.byCategory} direction="horizontal" ariaLabel={t("reports.byCategory")} />
                </Card>
                <Card title={t("reports.agentWorkload")} className="lg:col-span-2">
                  <DataTable
                    headers={[t("admin.name"), t("admin.workload")]}
                    rows={data.agentWorkload.map((d) => [d.name, String(d.total)])}
                  />
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
