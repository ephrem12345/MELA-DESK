"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card, Field, Input, ErrorState } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n/provider";
import { useRouter } from "next/navigation";
import { ApiError, isMockMode } from "@/lib/api/client";
import { MockBanner } from "@/components/status-badges";

const schema = z.object({
  email: z.string().email("validation.emailInvalid"),
  password: z.string().min(8, "validation.passwordMin"),
});

export default function LoginPage() {
  const { t } = useI18n();
  const { login } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  type Values = { email: string; password: string };

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(
      schema.extend({
        email: z.string().email(t("validation.emailInvalid")),
        password: z.string().min(8, t("validation.passwordMin", { min: 8 })),
      })
    ),
  });

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      await login(values.email, values.password);
      const params = new URLSearchParams(location.search);
      router.push(params.get("redirect") || "/dashboard");
    } catch (e) {
      setError(e instanceof ApiError && e.code === "UNAUTHENTICATED" ? t("auth.invalidCredentials") : t("errors.generic"));
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <MockBanner />
      <p className="mb-6 text-center text-lg font-bold text-blue-700">MELA<span className="text-slate-800"> DESK</span></p>
      <Card>
        <h1 className="text-lg font-semibold text-slate-900">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-xs text-slate-500">{t("auth.loginSubtitle")}</p>
        {error && <ErrorState message={error} />}
        <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label={t("auth.email")} htmlFor="email" required error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field label={t("auth.password")} htmlFor="password" required error={errors.password?.message}>
            <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
          </Field>
          <Button type="submit" loading={isSubmitting} className="w-full">{t("common.signIn")}</Button>
        </form>
        <div className="mt-3 flex items-center justify-between text-xs">
          <Link className="text-blue-600 hover:underline" href="/forgot-password">{t("auth.forgotLink")}</Link>
          <span className="text-slate-500">
            {t("auth.noAccount")} <Link className="text-blue-600 hover:underline" href="/register">{t("auth.createAccount")}</Link>
          </span>
        </div>
        {isMockMode() && (
          <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
            Dev accounts (password: Password123!): requester@meladesk.test · agent@meladesk.test · lead@meladesk.test · admin@meladesk.test
          </p>
        )}
      </Card>
    </div>
  );
}
