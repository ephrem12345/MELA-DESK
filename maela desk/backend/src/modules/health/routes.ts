import { Router } from "express";
import { prisma, probeDatabase } from "../../config/database.js";
import { unavailable } from "../../errors/app-error.js";

export const healthRouter = Router();

healthRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString(), requestId: req.requestId });
});

healthRouter.get("/ready", async (_req, res) => {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, probeDatabase()]);
    res.status(200).json({ status: "ready" });
  } catch {
    res.status(unavailable().status).json({ status: "not_ready", error: { code: "DATABASE_UNAVAILABLE" } });
  }
});
