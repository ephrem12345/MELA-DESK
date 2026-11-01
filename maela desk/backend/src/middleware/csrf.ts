import { randomBytes, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";

function cookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
  } as const;
}

export function csrfBootstrap(): RequestHandler {
  return (req, res) => {
    const token = randomBytes(32).toString("base64url");
    res.cookie(env.CSRF_COOKIE_NAME, token, cookieOptions(false));
    res.status(200).json({ token });
  };
}

export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.header("origin");
  if (origin && !env.FRONTEND_ORIGINS.includes(origin)) {
    return next(new AppError(403, "UNTRUSTED_ORIGIN", "The request origin is not allowed."));
  }

  const cookieToken = req.cookies?.[env.CSRF_COOKIE_NAME];
  const headerToken = req.header("x-csrf-token");
  if (!cookieToken || !headerToken) {
    return next(new AppError(403, "CSRF_REQUIRED", "A valid CSRF token is required."));
  }
  const left = Buffer.from(cookieToken);
  const right = Buffer.from(headerToken);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return next(new AppError(403, "CSRF_INVALID", "The CSRF token is invalid."));
  }
  next();
};

export function csrfCookieOptions(httpOnly = false) {
  return cookieOptions(httpOnly);
}
