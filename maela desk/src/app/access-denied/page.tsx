"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function AccessDeniedPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Card>
        <div role="alert" className="text-center">
          <AlertTriangle aria-hidden className="mx-auto mb-2 text-amber-500" />
          <h1 className="text-lg font-semibold text-slate-900">{t("auth.accessDeniedTitle")}</h1>
          <p className="mt-1 text-xs text-slate-500">{t("auth.accessDeniedBody")}</p>
          <Link href="/dashboard" className="mt-4 inline-block">
            <Button variant="secondary">{t("auth.goToDashboard")}</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
