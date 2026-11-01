import mysql from "mysql2/promise";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "./env.js";

function mysqlOptions(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

const options = mysqlOptions(env.DATABASE_URL);
const adapter = new PrismaMariaDb({ ...options, connectionLimit: 10 });

export const prisma = new PrismaClient({ adapter });

// mysql2 is kept as the low-level operational probe and for bounded diagnostics;
// domain queries and transactions use Prisma.
export const mysqlProbePool = mysql.createPool({
  ...options,
  connectionLimit: 1,
  connectTimeout: 5000,
  enableKeepAlive: true,
});

export async function probeDatabase(): Promise<void> {
  await mysqlProbePool.query("SELECT 1");
}

export async function closeDatabases(): Promise<void> {
  await Promise.allSettled([prisma.$disconnect(), mysqlProbePool.end()]);
}
