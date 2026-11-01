import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.x-csrf-token",
      "req.body.password",
      "req.body.currentPassword",
      "req.body.newPassword",
      "req.body.token",
      "req.body.resetToken",
      "res.headers.set-cookie",
    ],
    censor: "[REDACTED]",
  },
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
