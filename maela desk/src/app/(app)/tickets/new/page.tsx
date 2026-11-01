"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Send } from "lucide-react";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { AttachmentUploader, type UploadedFile } from "@/components/attachment-uploader";
import { metaApi, ticketApi, ApiError, isMockMode } from "@/lib/api/client";
import { mockCategories } from "@/lib/api/mock";
import type { Category, Ticket } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/provider";
import { useToast } from "@/components/ui";

const schemaShape = {
  subject: z.string().min(10),
  description: z.string().min(20),
  categoryId: z.string().min(1),
  priority: z.string(),
  service: z.string().optional(),
  errorCode: z.string().optional(),
  steps: z.string().optional(),
  expected: z.string().optional(),
  actual: z.string().optional(),
};

export default function NewTicketPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [created, setCreated] = useState<Ticket | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  type Values = z.infer<ReturnType<typeof buildSchema>>;

  const buildSchema = () =>
    z.object({
      ...schemaShape,
      subject: z.string().min(10, t("validation.subjectMin", { min: 10 })),
      description: z.string().min(20, t("validation.descriptionMin", { min: 20 })),
      categoryId: z.string().min(1, t("validation.required")),
      priority: z.string().min(1, t("validation.required")),
    });

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Record<string, string>>({
    resolver: zodResolver(buildSchema()),
    defaultValues: { priority: "NORMAL" },
  });

  useEffect(() => {
    (async () => {
      try {
        setCategories(await metaApi.categories());
      } catch {
        if (isMockMode()) setCategories(mockCategories);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priority = watch("priority");

  const onSubmit = async (values: Record<string, string>) => {
    setSubmitError(null);
    try {
      const { ticket } = await ticketApi.create({
        subject: values.subject,
        description: [values.description, values.steps, values.expected, values.actual, values.errorCode]
          .filter(Boolean)
          .join("\n\n"),
        categoryId: values.categoryId,
        priority: values.priority,
        service: values.service,
        attachmentIds: attachments.map((a) => a.id),
      });
      setCreated(ticket);
      toast.push("success", t("ticket.createdSuccess"));
    } catch (e) {
      setSubmitError(e instanceof ApiError && e.code === "VALIDATION" ? t("errors.validated") : t("errors.generic"));
    }
  };

  if (created) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <div className="py-8 text-center">
            <CheckCircle2 aria-hidden className="mx-auto mb-3 size-10 text-green-600" />
            <h1 className="text-lg font-semibold text-slate-900">{t("ticket.createdSuccess")}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {t("ticket.ticketNumber")}:{" "}
              <span className="font-semibold text-blue-700">{created.ticketNumber}</span>
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Link href={`/tickets/${created.id}`}>
                <Button>{t("ticket.viewTicket")}</Button>
              </Link>
              <Link href="/tickets">
                <Button variant="secondary">{t("nav.tickets")}</Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t("ticket.createTitle")}</h1>
        <p className="text-xs text-slate-500">{t("ticket.createSubtitle")}</p>
      </div>

      {submitError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Card title={t("ticket.createTitle")}>
          <div className="grid gap-4">
            <Field label={t("ticket.fields.subject")} hint={t("ticket.fields.subjectHint")} required error={errors.subject?.message ?? undefined}>
              <Input id="subject" aria-invalid={!!errors.subject} {...register("subject", { required: t("validation.required") })} />
            </Field>
            <Field label={t("ticket.fields.description")} hint={t("ticket.fields.descriptionHint")} required error={errors.description?.message ?? undefined}>
              <Textarea id="description" rows={5} aria-invalid={!!errors.description} {...register("description", { required: t("validation.required") })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("ticket.fields.category")} required error={errors.categoryId?.message ?? undefined}>
                <Select id="categoryId" aria-invalid={!!errors.categoryId} {...register("categoryId")}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {locale === "am" ? c.labelAm : c.labelEn}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("ticket.fields.priority")} required error={errors.priority?.message ?? undefined}>
                <Select id="priority" aria-invalid={!!errors.priority} {...register("priority")}>
                  {(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((p) => (
                    <option key={p} value={p}>
                      {t(`priority.${p.toLowerCase()}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {priority === "URGENT" && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                Urgent tickets are triaged by the duty supervisor before agent assignment.
              </p>
            )}
          </div>
        </Card>

        <Card title={t("ticket.fields.attachments")}>
          <AttachmentUploader attachmentIds={attachments} onAttachmentsChange={setAttachments} disabled={isSubmitting} />
        </Card>

        <div className="flex justify-end gap-2">
          <Link href="/tickets">
            <Button type="button" variant="secondary">{t("common.cancel")}</Button>
          </Link>
          <Button type="submit" loading={isSubmitting}>
            <Send aria-hidden className="size-4" /> {t("common.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
