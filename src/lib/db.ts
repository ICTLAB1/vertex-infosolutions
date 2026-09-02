import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * One client per process.
 *
 * Next's dev server re-evaluates modules on every edit, and a fresh client each
 * time exhausts the database's connections within a few saves, so in
 * development the instance is parked on `globalThis` and reused.
 *
 * On Azure this points at Azure Database for PostgreSQL Flexible Server, which
 * requires TLS. `sslmode=require` belongs in `DATABASE_URL` rather than being
 * forced here, so a local Postgres without certificates still works.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env, or set it in the App Service configuration.",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    // App Service scales by adding instances, and Postgres Flexible Server
    // caps connections by tier. A small per-instance pool leaves room for the
    // other instances rather than one of them taking every slot.
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
