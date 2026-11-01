import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

const common = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  handler: (req: Request, res: Response, _next: NextFunction, _options: unknown) => {
    res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Try again later.", requestId: req.requestId } });
  },
};

export const generalRateLimit = rateLimit(common);
export const loginRateLimit = rateLimit({ ...common, windowMs: 15 * 60 * 1000, max: 12 });
export const registrationRateLimit = rateLimit({ ...common, windowMs: 60 * 60 * 1000, max: 10 });
export const passwordResetRateLimit = rateLimit({ ...common, windowMs: 60 * 60 * 1000, max: 5 });
export const ticketCreateRateLimit = rateLimit({ ...common, windowMs: 60 * 60 * 1000, max: 30 });
export const commentRateLimit = rateLimit({ ...common, windowMs: 60 * 60 * 1000, max: 60 });
export const uploadRateLimit = rateLimit({ ...common, windowMs: 60 * 60 * 1000, max: 30 });
export const reportRateLimit = rateLimit({ ...common, windowMs: 60 * 1000, max: 20 });
