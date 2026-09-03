import { NextResponse } from "next/server";

import { cronGuard } from "@/lib/cron";
import { retryFailedNotifications } from "@/lib/outbox";

/**
 * Send again what failed to send.
 *
 * The outbox has always recorded failures; nothing read them back. A licence
 * key email that bounced off a full mailbox was a customer who had paid and
 * had nothing, until somebody noticed.
 *
 * Point the same scheduler at this that calls the renewal sweep, but more
 * often — every fifteen minutes is sensible, because the back-off inside
 * decides when each message is actually due and a run with nothing to do costs
 * one indexed query:
 *
 *     curl -fsS -X POST https://…/api/cron/notifications \
 *          -H "x-vertex-cron-key: $CRON_SECRET"
 *
 * Safe to run twice at once: every message is claimed with a compare-and-swap
 * before it is sent, so the second run finds nothing left to take.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const refused = cronGuard(request);
  if (refused) return refused;

  try {
    const result = await retryFailedNotifications();
    // Logged as well as returned: a scheduler discards the body, and "did the
    // keys ever reach them?" needs an answer.
    if (result.due > 0) {
      console.log(
        `[outbox] due=${result.due} sent=${result.sent} failed=${result.failed} abandoned=${result.abandoned} raced=${result.raced}`,
      );
    }
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error("[outbox] sweep failed", error);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
