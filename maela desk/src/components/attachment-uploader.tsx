"use client";

import { useRef, useState } from "react";
import { FileUp, File as FileIcon, Trash2, UploadCloud } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { attachmentApi } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

const MAX_SIZE_MB = 10;
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".pdf", ".txt", ".csv", ".doc", ".docx", ".log"];

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
}

export function AttachmentUploader({
  attachmentIds,
  onAttachmentsChange,
  disabled,
}: {
  attachmentIds: UploadedFile[];
  onAttachmentsChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    const ok = ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!ok) return t("errors.fileType", { types: ALLOWED_EXTENSIONS.join(", ") });
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return t("errors.fileTooLarge", { max: `${MAX_SIZE_MB} MB` });
    return null;
  };

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    setUploading(true);
    const accepted: UploadedFile[] = [];
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      const err = validate(file);
      if (err) {
        failures.push(err);
        continue;
      }
      try {
        const { id } = await attachmentApi.upload(file);
        accepted.push({ id, name: file.name, size: file.size });
      } catch {
        failures.push(`${file.name}: ${t("ticket.uploadFailed")}`);
      }
    }
    setUploading(false);
    if (failures.length) setError(failures[0]);
    if (accepted.length) onAttachmentsChange([...attachmentIds, ...accepted]);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t("ticket.fields.attachments")}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-600",
          dragging && "border-blue-500 bg-blue-50"
        )}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
        }}
      >
        {uploading ? <UploadCloud aria-hidden className="size-5 animate-bounce" /> : <FileUp aria-hidden className="size-5" />}
        <span>{t("ticket.dragDrop")}</span>
        <span className="text-slate-400">{`${t("errors.fileType", { types: ALLOWED_EXTENSIONS.join(", ") })} · max ${MAX_SIZE_MB} MB`}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
      {attachmentIds.length > 0 && (
        <ul className="mt-2 space-y-1">
          {attachmentIds.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
              <span className="flex items-center gap-1.5 text-slate-700">
                <FileIcon aria-hidden className="size-3.5 text-slate-400" />
                {f.name} <span className="text-slate-400">{formatBytes(f.size)}</span>
              </span>
              <button
                aria-label={`${t("common.delete")} ${f.name}`}
                onClick={() => onAttachmentsChange(attachmentIds.filter((x) => x.id !== f.id))}
                className="text-slate-400 hover:text-red-600"
              >
                <Trash2 aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
