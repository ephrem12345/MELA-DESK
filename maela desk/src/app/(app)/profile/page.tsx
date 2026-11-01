"use client";

import { useState } from "react";
import { Button, Card, ConfirmDialog, Field, Input, Select, useToast } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { useSession } from "@/lib/session";
import { isMockMode, metaApi } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n/provider";

export default function ProfilePage() {
  const { t, locale, setLocale } = useI18n();
  const { user, refresh } = useSession();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [timezone, setTimezone] = useState("UTC");

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.profile")}</h1>

      <Card title={t("common.appName")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("auth.fullName")} htmlFor="profile-name">
            <Input id="profile-name" defaultValue={user.name} />
          </Field>
          <Field label={t("auth.email")}>
            <Input value={user.email} readOnly aria-readonly className="bg-slate-50 text-slate-500" />
          </Field>
          <Field label={t("admin.role")}>
            <Input value={t(`roles.${user.role.toLowerCase()}`)} readOnly className="bg-slate-50 text-slate-500" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            loading={saving}
            variant="secondary"
            onClick={async () => {
              setSaving(true);
              const input = document.getElementById("profile-name") as HTMLInputElement | null;
              const name = input?.value.trim();
              try {
                if (!name) { toast.push("error", t("validation.required")); return; }
                if (isMockMode()) {
                  const stored = window.localStorage.getItem("mela-mock-user");
                  if (stored) window.localStorage.setItem("mela-mock-user", JSON.stringify({ ...JSON.parse(stored), name }));
                  toast.push("info", "Development mode: profile changes are local to this browser.");
                  await refresh();
                } else {
                  await metaApi.updateUser(user.id, { name });
                  await refresh();
                  toast.push("success", t("common.save"));
                }
              } catch {
                toast.push("error", t("errors.generic"));
              } finally {
                setSaving(false);
              }
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      </Card>

      <Card title={t("nav.settings")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Language" htmlFor="pref-language" hint={t("mockBanner")}>
            <Select
              id="pref-language"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="en">English</option>
              <option value="am">አማርኛ (Amharic)</option>
            </Select>
          </Field>
          <Field label="Timezone">
            <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {["UTC", "Africa/Addis_Ababa", "Europe/London", "America/New_York"].map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            loading={savingPrefs}
            onClick={async () => {
              setSavingPrefs(true);
              try {
                if (isMockMode()) {
                  const stored = window.localStorage.getItem("mela-mock-user");
                  if (stored) window.localStorage.setItem("mela-mock-user", JSON.stringify({ ...JSON.parse(stored), preferredLanguage: locale, timeZone: timezone }));
                  await refresh();
                  toast.push("info", "Development mode: preferences are local to this browser.");
                } else {
                  await metaApi.updateUser(user.id, { preferredLanguage: locale, timeZone: timezone });
                  await refresh();
                  toast.push("success", t("common.save"));
                }
              } catch {
                toast.push("error", t("errors.generic"));
              } finally {
                setSavingPrefs(false);
              }
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      </Card>

      <Card title={t("notifications.title")}>
        <p className="text-xs text-slate-500">Notification channels and quiet hours are configured by the backend once available.</p>
      </Card>
    </div>
  );
}
