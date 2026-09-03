import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The shared secret the scheduled endpoints are behind.
 *
 * Both sweeps — renewal reminders and the outbox retry — send real email, so
 * an open endpoint would let anyone spend the store's sending reputation and
 * its mail bill. One secret rather than two: they are called by the same
 * scheduler, and a second secret would be a second thing to rotate and forget.
 */
export function cronConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET);
}

export function cronAuthorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const given =
    request.headers.get("x-vertex-cron-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  // Digests rather than the raw values, so the comparison is constant-time and
  // constant-length — a length mismatch would otherwise leak through
  // timingSafeEqual, which throws on unequal buffers.
  return timingSafeEqual(
    createHash("sha256").update(given).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

/** The 503 every scheduled endpoint gives when no secret is configured. */
export function cronGuard(request: Request): Response | null {
  if (!cronConfigured()) {
    console.error("[cron] CRON_SECRET is not set; scheduled work cannot run");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  if (!cronAuthorised(request)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  return null;
}
