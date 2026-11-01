"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, Clock3, CheckCircle2, Ban, CircleHelp } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import type { Priority, SlaIndicator, TicketStatus } from "@/lib/api/types";

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useI18n();
  const tones: Record<TicketStatus, BadgeTone> = {
    OPEN: "primary",
    IN_PROGRESS: "info",
    PENDING_REQUESTER: "warning",
    PENDING_THIRD_PARTY: "warning",
    RESOLVED: "success",
    CLOSED: "neutral",
  };
  const icons: Record<TicketStatus, React.ReactNode> = {
    OPEN: <CircleHelp aria-hidden className="size-3" />,
    IN_PROGRESS: <Clock3 aria-hidden className="size-3" />,
    PENDING_REQUESTER: <Clock3 aria-hidden className="size-3" />,
    PENDING_THIRD_PARTY: <Clock3 aria-hidden className="size-3" />,
    RESOLVED: <CheckCircle2 aria-hidden className="size-3" />,
    CLOSED: <Ban aria-hidden className="size-3" />,
  };
  return (
    <Badge tone={tones[status]}>
      {icons[status]}
      {t(`status.${status.toLowerCase()}`)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { t } = useI18n();
  const tones: Record<Priority, BadgeTone> = {
    LOW: "neutral",
    NORMAL: "info",
    HIGH: "warning",
    URGENT: "danger",
  };
  return <Badge tone={tones[priority]}>{t(`priority.${priority.toLowerCase()}`)}</Badge>;
}

export function SlaBadge({ indicator, dueAt }: { indicator: SlaIndicator; dueAt?: string | null }) {
  const { t, locale } = useI18n();
  const tones: Record<SlaIndicator, BadgeTone> = {
    ON_TRACK: "success",
    AT_RISK: "warning",
    BREACHED: "danger",
    COMPLETED: "info",
    NOT_APPLICABLE: "neutral",
  };
  const label = t(`sla.${indicator.toLowerCase()}`);
  if (indicator === "NOT_APPLICABLE") return <Badge tone="neutral">{label}</Badge>;
  const due = dueAt ? new Date(dueAt) : null;
  const suffix = due ? ` · ${new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(due)}` : "";
  return (
    <Badge tone={tones[indicator]}>
      <ArrowUpRight aria-hidden className="size-3" />
      {label}
      {suffix}
    </Badge>
  );
}

/** Live countdown that handles expired and missing deadlines. */
export function SlaCountdown({ dueAt }: { dueAt: string | null }) {
  const { locale, t } = useI18n();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);
  if (!dueAt) return <span className="text-xs text-slate-400">—</span>;
  const diffMs = new Date(dueAt).getTime() - Date.now();
  if (diffMs <= 0) return <span className="text-xs font-medium text-red-600">{t("sla.overdue")}</span>;
  const fmt = new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
  return <span className="text-xs text-slate-500">{fmt.format(new Date(dueAt))}</span>;
}

/** Accessible sr-only announcement helper for status changes. */
export function useLiveRegion() {
  const [announcement, setAnnouncement] = useState("");
  const announce = (message: string) => setTimeout(() => setAnnouncement(message), 50);
  const node = (
    <div aria-live="polite" role="status" className="sr-only">
      {announcement}
    </div>
  );
  return { announce, node };
}

export function MockBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(process.env.NEXT_PUBLIC_USE_MOCKS === "true" && process.env.NODE_ENV !== "production");
  }, []);
  if (!visible) return null;
  return (
    <div role="status" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
      <AlertTriangle aria-hidden className="size-3.5" />
      {t("mockBanner")}
    </div>
  );
}
