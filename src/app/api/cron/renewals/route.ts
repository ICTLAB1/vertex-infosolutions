import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { sendRenewalReminders } from "@/lib/renewals";

/**
 * The renewal reminder sweep.
 *
 * The store promises, on four pages and in the welcome email, that we remind
 * customers a month before a subscription expires. This is the thing that keeps
 * that promise. Point a scheduler at it once a day:
 *
 *     curl -fsS -X POST https://…/api/cron/renewals \
 *          -H "x-vertex-cron-key: $CRON_SECRET"
 *
 * On Azure that is a Logic App recurrence, a Container Apps job, or App
 * Service's own WebJob — anything that can make one authenticated request a
 * day. Running it more often is harmless: every reminder is claimed with a
 * conditional update before it is sent, so a second run inside the same day
 * finds nothing left to send.
 *
 * It is authenticated by a shared secret rather than left open. An open
 * endpoint here would let anyone burn through the reminder window early, and
 * every send costs real money at the mail provider.
 */
export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header =
    request.headers.get("x-vertex-cron-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  // Digests rather than the raw values, so the comparison is constant-time and
  // constant-length — a length mismatch would otherwise leak through
  // timingSafeEqual, which throws on unequal buffers.
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[renewals] CRON_SECRET is not set; the sweep cannot run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  try {
    const result = await sendRenewalReminders();
    // Logged as well as returned: whatever calls this usually discards the
    // body, and "did the reminders go out on the 3rd?" needs an answer.
    console.log(
      `[renewals] due=${result.due} reminded=${result.reminded} skipped=${result.skipped} failed=${result.failed}`,
    );
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error("[renewals] sweep failed", error);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
