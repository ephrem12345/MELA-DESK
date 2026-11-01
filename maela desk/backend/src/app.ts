import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { AppError } from "./errors/app-error.js";
import { errorHandler, routeNotFound } from "./middleware/error-handler.js";
import { requireCsrf } from "./middleware/csrf.js";
import { optionalAuthentication } from "./middleware/authenticate.js";
import { generalRateLimit } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";
import { authRouter } from "./modules/auth/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import { auditRouter } from "./modules/audit/routes.js";
import { attachmentRouter } from "./modules/attachments/routes.js";
import { catalogRouter } from "./modules/catalog/routes.js";
import { commentRouter } from "./modules/comments/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { departmentRouter } from "./modules/departments/routes.js";
import { healthRouter } from "./modules/health/routes.js";
import { notificationRouter } from "./modules/notifications/routes.js";
import { reportRouter } from "./modules/reports/routes.js";
import { settingsRouter } from "./modules/settings/routes.js";
import { slaRouter } from "./modules/sla/routes.js";
import { teamRouter } from "./modules/teams/routes.js";
import { ticketRouter } from "./modules/tickets/routes.js";
import { userRouter } from "./modules/users/routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", 1);

  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as unknown as { requestId: string }).requestId }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" }, contentSecurityPolicy: false }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
      callback(new AppError(403, "UNTRUSTED_ORIGIN", "The request origin is not allowed."));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Request-Id", "Idempotency-Key"],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
    maxAge: 600,
  }));
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "64kb" }));
  app.use(cookieParser());
  app.use(generalRateLimit);
  app.use("/api", requireCsrf);
  app.use(optionalAuthentication);

  const mountApi = (prefix: string) => {
    app.use(prefix, healthRouter);
    app.use(prefix, catalogRouter);
    app.use(`${prefix}/auth`, authRouter);
    app.use(`${prefix}/tickets`, ticketRouter);
    app.use(`${prefix}/comments`, commentRouter);
    app.use(prefix, attachmentRouter);
    app.use(`${prefix}/users`, userRouter);
    app.use(`${prefix}/departments`, departmentRouter);
    app.use(`${prefix}/teams`, teamRouter);
    app.use(`${prefix}/notifications`, notificationRouter);
    app.use(`${prefix}/reports`, reportRouter);
    app.use(`${prefix}/audit-logs`, auditRouter);
    app.use(prefix, adminRouter);
    app.use(`${prefix}/sla`, slaRouter);
    app.use(`${prefix}/settings`, settingsRouter);
    app.use(`${prefix}/dashboard`, dashboardRouter);
  };

  // Keep the current frontend's /api URLs and provide the versioned API contract.
  mountApi("/api/v1");
  mountApi("/api");
  app.use(routeNotFound);
  app.use(errorHandler);
  return app;
}
