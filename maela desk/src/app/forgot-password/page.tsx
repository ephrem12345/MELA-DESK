"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { authApi } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="mb-6 text-center text-lg font-bold text-blue-700">MELA<span className="text-slate-800"> DESK</span></p>
      <Card>
        <h1 className="text-lg font-semibold text-slate-900">{t("auth.forgotTitle")}</h1>
        {sent ? (
          <p className="mt-2 text-sm text-green-700">If an account exists for this address, a reset link has been sent.</p>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setBusy(true);
            try {
              await authApi.forgotPassword(email);
              setSent(true);
            } catch {
              setError(t("errors.generic"));
            } finally {
              setBusy(false);
            }
          }} noValidate>
            <Field label={t("auth.email")} htmlFor="email" required>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </Field>
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={busy}>{t("common.submit")}</Button>
          </form>
        )}
        <p className="mt-3 text-center text-xs"><Link className="text-blue-600 hover:underline" href="/login">{t("common.signIn")}</Link></p>
      </Card>
    </div>
  );
}
