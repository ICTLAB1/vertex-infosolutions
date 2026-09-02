import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * One client per process. Next's dev server re-evaluates modules on every edit,
 * and a fresh client each time exhausts the database's connections within a few
 * saves, so in development the instance is parked on `globalThis` and reused.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    // Prisma 7 resolves a relative SQLite path against `prisma7.config.ts` at
    // the project root, which is also where `next` runs — so the same
    // `file:./dev.db` means the same file to the CLI and to the app.
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
