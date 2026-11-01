'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


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
