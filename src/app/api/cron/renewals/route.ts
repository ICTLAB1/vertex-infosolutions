import { NextResponse } from "next/server";

import { cronGuard } from "@/lib/cron";
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

export async function POST(request: Request) {
  const refused = cronGuard(request);
  if (refused) return refused;

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
