"use client";

import Link from "next/link";
import { Bell, Globe, KeyRound, UserCircle2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function SettingsPage() {
  const { t } = useI18n();
  const sections = [
    { icon: <UserCircle2 aria-hidden className="size-4 text-blue-600" />, title: t("nav.profile"), href: "/profile" },
    { icon: <Globe aria-hidden className="size-4 text-blue-600" />, title: t("admin.localization"), href: "/profile" },
    { icon: <KeyRound aria-hidden className="size-4 text-blue-600" />, title: t("auth.password"), href: "/reset-password" },
    { icon: <Bell aria-hidden className="size-4 text-blue-600" />, title: t("nav.notifications"), href: "/notifications" },
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.settings")}</h1>
      <ul className="grid gap-2">
        {sections.map((s) => (
          <li key={s.title}>
            <Card>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  {s.icon} {s.title}
                </span>
                <Link href={s.href}>
                  <Button variant="secondary">{t("common.view")}</Button>
                </Link>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
