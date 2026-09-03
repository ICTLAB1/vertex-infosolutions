import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * Liveness and readiness for App Service.
 *
 * The probe touches the database rather than only returning 200, because an
 * instance that cannot reach Postgres serves nothing but errors and should be
 * taken out of rotation rather than left to fail requests. The query is the
 * cheapest one there is.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "reachable",
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    // The message is deliberately vague: a health endpoint is unauthenticated
    // and a connection string in an error body is a credential leak.
    console.error("Health check failed", error);
    return NextResponse.json(
      { status: "degraded", database: "unreachable" },
      { status: 503 },
    );
  }
}
