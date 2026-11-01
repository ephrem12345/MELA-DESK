import "dotenv/config";
import { z } from "zod";

const boolFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return value.trim().toLowerCase() === "true";
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url().startsWith("mysql://"),
  FRONTEND_ORIGINS: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().min(1).default("mela_session"),
  CSRF_COOKIE_NAME: z.string().min(1).default("mela_csrf"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_SECURE: boolFromEnv.default(false),
  TRUST_PROXY: boolFromEnv.default(false),
  UPLOAD_DIR: z.string().min(1).default("./var/private-uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(52428800).default(10 * 1024 * 1024),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(25).default(8),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(10).max(1000).default(120),
  SMTP_HOST: z.string().optional().transform((value) => value?.trim() || undefined),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: boolFromEnv.default(false),
  SMTP_USER: z.string().optional().transform((value) => value?.trim() || undefined),
  SMTP_PASSWORD: z.string().optional().transform((value) => value || undefined),
  SMTP_FROM: z.string().email().or(z.string().regex(/^.+<[^<>]+>$/)).default("MELA DESK <no-reply@localhost>"),
  PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  OUTBOX_INTERVAL_MS: z.coerce.number().int().min(1000).max(300000).default(5000),
  SLA_INTERVAL_MS: z.coerce.number().int().min(10000).max(3600000).default(60000),
  HOUSEKEEPING_INTERVAL_MS: z.coerce.number().int().min(60000).max(604800000).default(86400000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DEV_SEED_PASSWORD: z.string().min(8).max(128).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid backend environment configuration: ${fields}`);
}

if (parsed.data.COOKIE_SAME_SITE === "none" && !parsed.data.COOKIE_SECURE && parsed.data.NODE_ENV === "production") {
  throw new Error("COOKIE_SECURE must be true when COOKIE_SAME_SITE=none in production");
}

export const env = {
  ...parsed.data,
  FRONTEND_ORIGINS: parsed.data.FRONTEND_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
};

export type BackendEnv = typeof env;
