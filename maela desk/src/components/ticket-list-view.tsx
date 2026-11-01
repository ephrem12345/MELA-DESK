"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Search, X } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, Select, TableSkeleton } from "@/components/ui";
import { Pagination } from "@/components/ui";
import { TicketTable } from "@/components/ticket-views";
import { ticketApi, ApiError, isMockMode } from "@/lib/api/client";
import { filterMockTickets, mockTickets } from "@/lib/api/mock";
import type { SlaIndicator, Ticket, TicketStatus, Priority } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/provider";

type FiltersState = {
  q: string;
  status: string;
  priority: string;
  sla: string;
  page: string;
  sort: string;
};

export type PresetFilters = Partial<{
  status: TicketStatus;
  priority: Priority;
  sla: SlaIndicator;
  assignedAgentId: string;
  categoryId: string;
}>;

export function TicketListView({ preset, title }: { preset?: PresetFilters; title?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: FiltersState = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      status: preset?.status ?? searchParams.get("status") ?? "",
      priority: preset?.priority ?? searchParams.get("priority") ?? "",
      sla: preset?.sla ?? searchParams.get("sla") ?? "",
      page: searchParams.get("page") ?? "1",
      sort: searchParams.get("sort") ?? "updatedAt",
    }),
    [searchParams, preset]
  );

  const [searchInput, setSearchInput] = useState(filters.q);
  useEffect(() => setSearchInput(filters.q), [filters.q]);

  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value) sp.set(key, value);
      else sp.delete(key);
      if (key !== "page") sp.delete("page");
      router.replace(`${pathname}?${sp.toString()}`);
    },
    [searchParams, pathname, router]
  );

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await ticketApi.list(
          {
            q: filters.q || undefined,
            status: (filters.status || undefined) as TicketStatus,
            priority: (filters.priority || undefined) as Priority,
            sla: (filters.sla || undefined) as SlaIndicator,
            page: Number(filters.page) || 1,
            sort: filters.sort as "createdAt" | "updatedAt" | "priority",
          },
          controller.signal
        );
        setTickets(result.items);
        setTotal(result.total);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (isMockMode()) {
          const p = filterMockTickets({
            q: filters.q || undefined,
            status: (filters.status || undefined) as TicketStatus,
            priority: (filters.priority || undefined) as Priority,
            page: Number(filters.page) || 1,
            sla: (filters.sla || undefined) as SlaIndicator,
          });
          setTickets(p.items);
          setTotal(p.total);
        } else {
          setError(t("errors.generic"));
        }
      } finally {
        setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.status, filters.priority, filters.sla, filters.page, filters.sort]);

  const hasFilters = !!(filters.q || filters.status || filters.priority || filters.sla);
  const page = Number(filters.page) || 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{title ?? t("ticket.listTitle")}</h1>
        <form
          className="flex w-full max-w-sm gap-2"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            updateParam("q", searchInput);
          }}
        >
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
            <input
              aria-label={t("common.search")}
              className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-8 text-sm"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("common.search")}
            />
            {searchInput && (
              <button
                type="button"
                aria-label={t("common.reset")}
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                onClick={() => {
                  setSearchInput("");
                  updateParam("q", "");
                }}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button type="submit">{t("common.search")}</Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={t("ticket.fields.status")} value={filters.status} onChange={(e) => updateParam("status", e.target.value)} className="w-44">
          <option value="">{t("common.all")} — {t("ticket.fields.status")}</option>
          {(["OPEN", "IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"] as const).map((s) => (
            <option key={s} value={s}>{t(`status.${s.toLowerCase()}`)}</option>
          ))}
        </Select>
        <Select aria-label={t("ticket.fields.priority")} value={filters.priority} onChange={(e) => updateParam("priority", e.target.value)} className="w-44">
          <option value="">{t("common.all")} — {t("ticket.fields.priority")}</option>
          {(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((p) => (
            <option key={p} value={p}>{t(`priority.${p.toLowerCase()}`)}</option>
          ))}
        </Select>
        <Select aria-label="SLA" value={filters.sla} onChange={(e) => updateParam("sla", e.target.value)} className="w-44">
          <option value="">{t("common.all")} — SLA</option>
          {(["ON_TRACK", "AT_RISK", "BREACHED", "COMPLETED"] as const).map((s) => (
            <option key={s} value={s}>{t(`sla.${s.toLowerCase()}`)}</option>
          ))}
        </Select>
        <Select aria-label="Sort" value={filters.sort} onChange={(e) => updateParam("sort", e.target.value)} className="w-40">
          <option value="createdAt">Created ↑</option>
          <option value="updatedAt">Updated ↑</option>
        </Select>
        {hasFilters && (
          <Button variant="ghost" onClick={() => router.replace(pathname)}>
            <X aria-hidden className="size-3.5" /> {t("common.reset")}
          </Button>
        )}
      </div>

      {error ? <ErrorState message={error} onRetry={() => updateParam("page", String(page))} /> : null}
      {!error && loading && tickets === null && <TableSkeleton rows={8} cols={6} />}
      {!error && !loading && tickets?.length === 0 && (
        <EmptyState
          icon={<Search className="size-10" />}
          title={t("common.noResults")}
          description={hasFilters ? t("common.reset") : undefined}
        />
      )}
      {!error && !loading && tickets && tickets.length > 0 && (
        <>
          <Card>
            <TicketTable tickets={tickets} showRequester />
          </Card>
          {total > 10 && (
            <Pagination
              page={page}
              total={total}
              pageSize={10}
              onChange={(p) => updateParam("page", String(p))}
            />
          )}
        </>
      )}
    </div>
  );
}

export function TicketListViewWithSuspense(props: React.ComponentProps<typeof TicketListView>) {
  return (
    <Suspense>
      <TicketListView {...props} />
    </Suspense>
  );
}
