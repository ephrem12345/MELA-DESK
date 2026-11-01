'use client';

import { useEffect, useState } from "react";
import { PageHeader, DataTable } from "@/components/admin-shared";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Select, TableSkeleton, Textarea, useToast } from "@/components/ui";
import { metaApi, isMockMode } from "@/lib/api/client";
import { mockUsers, mockAuditLogs, mockCategories, mockTeams } from "@/lib/api/mock";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";


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
