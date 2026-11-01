"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card, Field, Input, ErrorState } from "@/components/ui";
import { MockBanner } from "@/components/status-badges";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n/provider";
import { ApiError } from "@/lib/api/client";

type Values = { name: string; email: string; password: string; confirmPassword: string };

export default function RegisterPage() {
  const { t } = useI18n();
  const { register: doRegister } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(
      z.object({
        name: z.string().min(2, t("validation.required")),
        email: z.string().email(t("validation.emailInvalid")),
        password: z.string().min(8, t("validation.passwordMin", { min: 8 })),
        confirmPassword: z.string(),
      }).refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: t("validation.passwordMismatch") })
    ),
  });

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      await doRegister({ name: values.name, email: values.email, password: values.password });
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with this email already exists. Please sign in instead.");
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts. Please wait a few minutes before trying again.");
      } else {
        setError(t("errors.generic"));
      }
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <MockBanner />
      <p className="mb-6 text-center text-lg font-bold text-blue-700">MELA<span className="text-slate-800"> DESK</span></p>
      <Card>
        <h1 className="text-lg font-semibold text-slate-900">{t("auth.registerTitle")}</h1>
        <p className="mt-1 text-xs text-slate-500">{t("auth.registerSubtitle")}</p>
        {error && <ErrorState message={error} />}
        <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label={t("auth.fullName")} htmlFor="name" required error={errors.name?.message}>
            <Input id="name" autoComplete="name" {...register("name")} />
          </Field>
          <Field label={t("auth.email")} htmlFor="email" required error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field label={t("auth.password")} htmlFor="password" required error={errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          </Field>
          <Field label={t("auth.confirmPassword")} htmlFor="confirmPassword" required error={errors.confirmPassword?.message}>
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
          </Field>
          <Button type="submit" loading={isSubmitting} className="w-full">{t("auth.createAccount")}</Button>
        </form>
        <p className="mt-3 text-center text-xs text-slate-500">
          {t("auth.haveAccount")} <Link className="text-blue-600 hover:underline" href="/login">{t("common.signIn")}</Link>
        </p>
      </Card>
    </div>
  );
}
