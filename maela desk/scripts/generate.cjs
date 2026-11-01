const fs = require("fs");
const path = require("path");
const root = path.join(process.cwd(), "src", "app");

function dir(p) {
  const full = path.join(root, p);
  fs.mkdirSync(full, { recursive: true });
  return full;
}
function w(p, content, page = true) {
  const full = path.join(dir(p), page ? "page.tsx" : "layout.tsx");
  fs.writeFileSync(full, content);
  console.log("wrote", full);
}

/* ---------- Auth pages ---------- */

w(
  "login",
  `"use client";

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
`
);

w(
  "register",
  `"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button, Card, Field, Input } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n/provider";
import { ErrorState } from "@/components/ui";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "mismatch" });

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
    } catch {
      setError(t("errors.generic"));
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
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
`
);

w(
  "forgot-password",
  `"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="mb-6 text-center text-lg font-bold text-blue-700">MELA<span className="text-slate-800"> DESK</span></p>
      <Card>
        <h1 className="text-lg font-semibold text-slate-900">{t("auth.forgotTitle")}</h1>
        {sent ? (
          <p className="mt-2 text-sm text-green-700">If an account exists for this address, a reset link has been sent.</p>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); setSent(true); }} noValidate>
            <Field label={t("auth.email")} htmlFor="email" required>
              <Input id="email" type="email" required />
            </Field>
            <Button type="submit" className="w-full">{t("common.submit")}</Button>
          </form>
        )}
        <p className="mt-3 text-center text-xs"><Link className="text-blue-600 hover:underline" href="/login">{t("common.signIn")}</Link></p>
      </Card>
    </div>
  );
}
`
);

w(
  "reset-password",
  `"use client";

import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="mb-6 text-center text-lg font-bold text-blue-700">MELA<span className="text-slate-800"> DESK</span></p>
      <Card>
        <h1 className="text-lg font-semibold text-slate-900">{t("auth.resetTitle")}</h1>
        {done ? (
          <p className="mt-2 text-sm text-green-700">Password updated. You can now sign in.</p>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); f.get("password") === f.get("confirm") ? setDone(true) : setError(t("validation.passwordMismatch")); }} noValidate>
            <Field label={t("auth.password")} htmlFor="password" required>
              <Input id="password" name="password" type="password" minLength={8} required />
            </Field>
            <Field label={t("auth.confirmPassword")} htmlFor="confirm" required>
              <Input id="confirm" name="confirm" type="password" required />
            </Field>
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <Button type="submit" className="w-full">{t("common.submit")}</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
`
);

w(
  "access-denied",
  `"use client";

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
`
);

console.log("auth pages done");
