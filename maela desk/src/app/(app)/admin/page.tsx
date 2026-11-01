'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


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
