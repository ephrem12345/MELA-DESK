import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, resolve } from "node:path";
import { Response, Request, Router } from "express";
import multer from "multer";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { badRequest, forbidden, notFound } from "../../errors/app-error.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { uploadRateLimit } from "../../middleware/rate-limit.js";
import { validateParams } from "../../middleware/validate.js";
import { canViewTicket } from "../../policies/tickets.js";
import { writeAudit } from "../../services/audit.js";
import { getAccessibleTicket } from "../tickets/service.js";
import { z } from "zod";

const idParams = z.object({ id: z.string().uuid() }).strict();
const attachmentIdParams = z.object({ id: z.string().uuid() }).strict();
const ticketAttachmentParams = z.object({ ticketId: z.string().uuid(), id: z.string().uuid().optional() }).strict();
const acceptedExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".pdf", ".txt", ".csv", ".doc", ".docx", ".log"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 8 },
  fileFilter: (_req, file, callback) => {
    if (!acceptedExtensions.has(extname(file.originalname).toLowerCase())) return callback(badRequest("FILE_TYPE_NOT_ALLOWED", "This file type is not allowed."));
    callback(null, true);
  },
});

function detectFile(file: Express.Multer.File): { extension: string; mimeType: string } {
  const bytes = file.buffer;
  const extension = extname(file.originalname).toLowerCase();
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (extension === ".png" && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { extension, mimeType: "image/png" };
  if ([".jpg", ".jpeg"].includes(extension) && starts(0xff, 0xd8, 0xff)) return { extension: ".jpg", mimeType: "image/jpeg" };
  if (extension === ".gif" && bytes.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/)) return { extension, mimeType: "image/gif" };
  if (extension === ".pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return { extension, mimeType: "application/pdf" };
  if (extension === ".doc" && starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return { extension, mimeType: "application/msword" };
  if (extension === ".docx" && starts(0x50, 0x4b, 0x03, 0x04)) return { extension, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  if ([".txt", ".csv", ".log"].includes(extension)) {
    if (bytes.includes(0)) throw badRequest("FILE_CONTENT_INVALID", "Text files cannot contain binary data.");
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw badRequest("FILE_CONTENT_INVALID", "Text files must use UTF-8 encoding."); }
    const mimeType = extension === ".csv" ? "text/csv" : "text/plain";
    return { extension, mimeType };
  }
  throw badRequest("FILE_SIGNATURE_INVALID", "The file content does not match its allowed type.");
}

function privateDirectory(): string {
  const directory = isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : resolve(process.cwd(), env.UPLOAD_DIR);
  return directory;
}

async function saveUpload(req: Request, file: Express.Multer.File, ticketId: string | null, commentId: string | null) {
  const detected = detectFile(file);
  const storageKey = `${randomUUID()}${detected.extension}`;
  const directory = privateDirectory();
  const target = join(directory, storageKey);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(target, file.buffer, { flag: "wx", mode: 0o600 });
  try {
    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        commentId,
        uploadedById: req.authUser!.id,
        originalName: basename(file.originalname).slice(0, 255),
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: BigInt(file.size),
        checksum: createHash("sha256").update(file.buffer).digest("hex"),
        expiresAt: ticketId ? null : new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await writeAudit(prisma, req, { actorId: req.authUser!.id, action: "attachment.uploaded", resourceType: "Attachment", resourceId: attachment.id, afterData: { ticketId, fileName: attachment.originalName, sizeBytes: attachment.sizeBytes.toString() } });
    return { id: attachment.id, fileName: attachment.originalName, fileSize: Number(attachment.sizeBytes), mimeType: attachment.mimeType, createdAt: attachment.createdAt.toISOString() };
  } catch (error) {
    const { unlink } = await import("node:fs/promises");
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

function setDownloadHeaders(res: Response, fileName: string, mimeType: string, size: bigint) {
  const safeFallback = fileName.replace(/[\r\n"\\]/g, "_");
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", size.toString());
  res.setHeader("Content-Disposition", `attachment; filename="${safeFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
}

async function streamAttachment(req: Request, res: Response, attachmentId: string, ticketId?: string) {
  const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, deletedAt: null } });
  if (!attachment) throw notFound();
  if (ticketId && attachment.ticketId !== ticketId) throw notFound();
  if (attachment.ticketId) {
    const ticket = await prisma.ticket.findFirst({ where: { id: attachment.ticketId, deletedAt: null } });
    if (!ticket || !canViewTicket(req.authUser!, ticket)) throw notFound();
  } else if (attachment.uploadedById !== req.authUser!.id) {
    throw notFound();
  }
  const filePath = join(privateDirectory(), attachment.storageKey);
  if (!filePath.startsWith(`${privateDirectory()}${process.platform === "win32" ? "\\" : "/"}`)) throw forbidden();
  setDownloadHeaders(res, attachment.originalName, attachment.mimeType, attachment.sizeBytes);
  await writeAudit(prisma, req, { actorId: req.authUser!.id, action: "attachment.downloaded", resourceType: "Attachment", resourceId: attachment.id });
  createReadStream(filePath).on("error", () => {
    if (!res.headersSent) res.status(404).end();
  }).pipe(res);
}

export const attachmentRouter = Router();
attachmentRouter.use(requireAuthentication);

attachmentRouter.post("/attachments", uploadRateLimit, upload.single("file"), async (req, res) => {
  if (!req.file) throw badRequest("FILE_REQUIRED", "Choose a file to upload.");
  res.status(201).json(await saveUpload(req, req.file, null, null));
});

attachmentRouter.post("/tickets/:ticketId/attachments", uploadRateLimit, validateParams(ticketAttachmentParams), upload.single("file"), async (req, res) => {
  await getAccessibleTicket(req, req.authUser!, req.params.ticketId);
  if (!req.file) throw badRequest("FILE_REQUIRED", "Choose a file to upload.");
  res.status(201).json(await saveUpload(req, req.file, req.params.ticketId, null));
});

attachmentRouter.get("/tickets/:ticketId/attachments", validateParams(ticketAttachmentParams), async (req, res) => {
  await getAccessibleTicket(req, req.authUser!, req.params.ticketId);
  const items = await prisma.attachment.findMany({ where: { ticketId: req.params.ticketId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  res.json({ items: items.map((item) => ({ id: item.id, fileName: item.originalName, fileSize: Number(item.sizeBytes), mimeType: item.mimeType, createdAt: item.createdAt.toISOString() })), total: items.length });
});

attachmentRouter.get("/attachments/:ticketId/:id", validateParams(ticketAttachmentParams), async (req, res) => {
  await streamAttachment(req, res, req.params.id!, req.params.ticketId);
});

attachmentRouter.get("/attachments/:id", validateParams(attachmentIdParams), async (req, res) => {
  await streamAttachment(req, res, req.params.id);
});

attachmentRouter.delete("/attachments/:id", validateParams(idParams), async (req, res) => {
  const attachment = await prisma.attachment.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!attachment) throw notFound();
  if (attachment.uploadedById !== req.authUser!.id && req.authUser!.role !== "ADMIN") {
    if (!attachment.ticketId) throw notFound();
    await getAccessibleTicket(req, req.authUser!, attachment.ticketId);
  }
  await prisma.attachment.update({ where: { id: attachment.id }, data: { deletedAt: new Date() } });
  await writeAudit(prisma, req, { actorId: req.authUser!.id, action: "attachment.deleted", resourceType: "Attachment", resourceId: attachment.id });
  res.status(204).end();
});
