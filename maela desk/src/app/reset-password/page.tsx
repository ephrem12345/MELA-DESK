"use client";

import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { authApi } from "@/lib/api/client";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="mb-6 text-center text-lg font-bold text-blue-700">MELA<span className="text-slate-800"> DESK</span></p>
      <Card>
        <h1 className="text-lg font-semibold text-slate-900">{t("auth.resetTitle")}</h1>
        {done ? (
          <p className="mt-2 text-sm text-green-700">Password updated. You can now sign in.</p>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const form = new FormData(e.currentTarget);
            const password = String(form.get("password") ?? "");
            if (password !== String(form.get("confirm") ?? "")) {
              setError(t("validation.passwordMismatch"));
              return;
            }
            const token = new URLSearchParams(window.location.search).get("token");
            if (!token) {
              setError(t("errors.generic"));
              return;
            }
            setBusy(true);
            try {
              await authApi.resetPassword(token, password);
              setDone(true);
            } catch {
              setError(t("errors.generic"));
            } finally {
              setBusy(false);
            }
          }} noValidate>
            <Field label={t("auth.password")} htmlFor="password" required>
              <Input id="password" name="password" type="password" minLength={8} required />
            </Field>
            <Field label={t("auth.confirmPassword")} htmlFor="confirm" required>
              <Input id="confirm" name="confirm" type="password" required />
            </Field>
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={busy}>{t("common.submit")}</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
