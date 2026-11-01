"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface Datum {
  label: string;
  total: number;
}

/** Dependency-free accessible bar chart (vertical bars or horizontal bars). */
export function BarChart({
  data,
  direction = "vertical",
  color = "#2563eb",
  className,
  ariaLabel,
}: {
  data: Datum[];
  direction?: "vertical" | "horizontal";
  color?: string;
  className?: string;
  ariaLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);
  if (direction === "horizontal") {
    return (
      <figure className={cn("w-full", className)}>
        <figcaption className="sr-only">{ariaLabel}</figcaption>
        <ul className="space-y-2">
          {data.map((d) => (
            <li key={d.label} className="flex items-center gap-2 text-xs">
              <span className="w-32 shrink-0 truncate text-slate-600">{d.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full rounded"
                  style={{ width: `${(d.total / max) * 100}%`, backgroundColor: color }}
                  role="img"
                  aria-label={`${d.label}: ${d.total}`}
                />
              </div>
              <span className="w-8 text-right font-medium text-slate-700">{d.total}</span>
            </li>
          ))}
        </ul>
      </figure>
    );
  }
  return (
    <figure className={cn("w-full", className)}>
      <figcaption className="sr-only">{ariaLabel}</figcaption>
      <div className="flex h-40 items-end gap-2" aria-hidden={false}>
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-medium text-slate-600">{d.total}</span>
            <div
              className="w-full max-w-[40px] rounded-t"
              style={{ height: `${Math.max(2, (d.total / max) * 120)}px`, backgroundColor: color }}
              role="img"
              aria-label={`${d.label}: ${d.total}`}
            />
            <span className="max-w-[72px] truncate text-[10px] text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Dependency-free accessible line/area chart for time series. */
export function LineChart({
  points,
  ariaLabel,
  className,
}: {
  points: { date: string; total: number }[];
  ariaLabel: string;
  className?: string;
}) {
  const gradId = useId();
  const w = 560;
  const h = 160;
  const max = Math.max(...points.map((p) => p.total), 1);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points.map((p, i) => [i * step, h - 20 - (p.total / max) * (h - 40)] as const);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;

  return (
    <figure className={cn("w-full", className)}>
      <figcaption className="sr-only">{ariaLabel}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 1 && <path d={area} fill={`url(#${gradId})`} />}
        {points.length > 1 && <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" />}
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#2563eb" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{points[0]?.date ?? ""}</span>
        <span>{points[points.length - 1]?.date ?? ""}</span>
      </div>
    </figure>
  );
}
