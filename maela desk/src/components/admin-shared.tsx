/** Small shared pieces for admin/team pages. */
"use client";

import { useEffect, useState } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/**
 * Simple data table wrapper. Kept dependency-free and accessible.
 */
export function DataTable({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty?: React.ReactNode }) {
  if (rows.length === 0) return empty ?? null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-slate-500">
            {headers.map((h, i) => (
              <th key={i} className="pb-2 pr-3 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
              {r.map((cell, ci) => (
                <td key={ci} className="py-2.5 pr-3 align-middle">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useAdminData<T>(loader: () => Promise<T>, fallback: () => T | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await loader();
        if (alive) setData(d);
      } catch {
        const fb = fallback();
        if (alive) {
          if (fb === null) setError("errors.generic");
          else setData(fb);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: () => setData(null) };
}
