import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * The database client.
 *
 * Constructed lazily, on first use rather than on import. That matters in three
 * places: a page that imports a module which merely *mentions* `prisma` no
 * longer needs a reachable database to render; `next build` does not need one
 * to compile; and a unit test can import `lib/auth` or `lib/notify` — both of
 * which reference this — without standing up Postgres first.
 *
 * One client per process. Next's dev server re-evaluates modules on every edit,
 * and a fresh client each time exhausts the database's connections within a few
 * saves, so in development the instance is parked on `globalThis` and reused.
 *
 * On Azure this points at Azure Database for PostgreSQL Flexible Server, which
 * requires TLS. The mode belongs in `DATABASE_URL` rather than being forced
 * here, so a local Postgres without certificates still works; the deployed
 * value asks for `verify-full`, which checks the server's certificate as well
 * as encrypting.
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

function client(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/**
 * A proxy so `prisma.order.findMany(...)` reads naturally while the client
 * underneath is still built on demand. Methods are bound to the real client,
 * because Prisma's own internals rely on `this`.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const real = client() as unknown as Record<string | symbol, unknown>;
    const value = real[property];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
