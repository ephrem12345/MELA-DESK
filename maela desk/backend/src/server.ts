import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { closeDatabases, prisma, probeDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { startOutboxWorker } from "./services/outbox.js";
import { startSlaWorker } from "./services/sla-worker.js";
import { startHousekeepingWorker } from "./services/housekeeping.js";

async function main() {
  await prisma.$connect();
  await probeDatabase();
  const app = createApp();
  const server = createServer(app);
  server.requestTimeout = 30000;
  server.headersTimeout = 35000;
  server.keepAliveTimeout = 5000;
  const outboxTimer = startOutboxWorker();
  const slaTimer = startSlaWorker();
  const housekeepingTimer = startHousekeepingWorker();

  server.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "MELA DESK API listening");
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "API shutdown started");
    clearInterval(outboxTimer);
    clearInterval(slaTimer);
    clearInterval(housekeepingTimer);
    server.close((error) => {
      if (error) logger.error({ err: error }, "HTTP server shutdown failed");
      void closeDatabases().finally(() => process.exit(error ? 1 : 0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch(async (error) => {
  logger.fatal({ err: error }, "API startup failed");
  await closeDatabases();
  process.exit(1);
});
