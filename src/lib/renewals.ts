import "server-only";

import { prisma } from "@/lib/db";
import type { LicenceTerm } from "@/generated/prisma/enums";
import { notify } from "@/lib/notify";
import { appUrl } from "@/lib/stripe";

/**
 * Licence lifetimes and renewal reminders.
 *
 * The store tells customers, on five pages and in the welcome email, that
 * nothing renews behind their back and that we remind them a month before a
 * subscription expires. This module is what makes that true rather than
 * copywriting.
 */

/**
 * How long a purchased licence runs for, in months.
 *
 * A monthly-commitment licence is billed monthly but committed for a year, so
 * its *licence* runs twelve months — the billing cadence and the term are
 * different things, and conflating them would expire somebody's software
 * eleven months early.
 */
const TERM_MONTHS: Record<LicenceTerm, number | null> = {
  ANNUAL_SUBSCRIPTION: 12,
  MONTHLY_COMMITMENT: 12,
  PERPETUAL: null,
};

/**
 * When a licence bought now stops working. Null for perpetual, which never
 * does.
 *
 * Month arithmetic is done on a UTC copy, and a day-of-month that does not
 * exist in the target month is pulled back to that month's last day — so a
 * licence bought on 31 January expires on 28 February, not silently on 3 March
 * as naive date maths would have it.
 */
export function expiryFor(term: LicenceTerm, from: Date): Date | null {
  const months = TERM_MONTHS[term];
  if (months === null) return null;

  const start = new Date(from.getTime());
  const day = start.getUTCDate();

  const expires = new Date(start.getTime());
  expires.setUTCDate(1);
  expires.setUTCMonth(expires.getUTCMonth() + months);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(expires.getUTCFullYear(), expires.getUTCMonth() + 1, 0),
  ).getUTCDate();
  expires.setUTCDate(Math.min(day, lastDayOfTargetMonth));

  return expires;
}

/** How many days from now until a licence expires; negative once it has. */
export function daysUntil(expiresAt: Date, now: Date = new Date()): number {
  const day = 24 * 60 * 60 * 1000;
  const from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const to = Date.UTC(
    expiresAt.getUTCFullYear(),
    expiresAt.getUTCMonth(),
    expiresAt.getUTCDate(),
  );
  return Math.round((to - from) / day);
}

/**
 * The reminder goes out this far ahead. A month is long enough to get a
 * purchase order approved, which is the actual constraint for most buyers.
 */
export const REMIND_DAYS_AHEAD = 30;

export type ExpiryState = "perpetual" | "active" | "expiring" | "expired";

export function expiryState(
  expiresAt: Date | null,
  now: Date = new Date(),
): ExpiryState {
  if (!expiresAt) return "perpetual";
  const days = daysUntil(expiresAt, now);
  if (days < 0) return "expired";
  if (days <= REMIND_DAYS_AHEAD) return "expiring";
  return "active";
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatExpiry(date: Date): string {
  return dayFormat.format(date);
}

/** How the expiry reads on a licence in the account. */
export function expiryLabel(
  expiresAt: Date | null,
  now: Date = new Date(),
): string {
  if (!expiresAt) return "Perpetual — no renewal";
  const days = daysUntil(expiresAt, now);
  if (days < 0) return `Expired ${formatExpiry(expiresAt)}`;
  if (days === 0) return `Expires today, ${formatExpiry(expiresAt)}`;
  if (days === 1) return `Expires tomorrow, ${formatExpiry(expiresAt)}`;
  return `Expires ${formatExpiry(expiresAt)} — ${days} days`;
}

// ---------------------------------------------------------------------------
// The reminder sweep
// ---------------------------------------------------------------------------

/** What one run of the sweep did, for the log and for the cron's response. */
export type RenewalSweep = {
  /** Licence lines inside the window that had not been reminded. */
  due: number;
  /** Messages actually sent. One per order per expiry date, not per line. */
  reminded: number;
  /** Groups another run had already claimed. */
  skipped: number;
  /** Groups whose send threw; their stamp is rolled back so the next run retries. */
  failed: number;
};

/**
 * Send the reminders that are due, and stamp them so they go once.
 *
 * Called by `POST /api/cron/renewals` on a schedule. It is safe to call more
 * often than daily and safe to call twice at once: the stamp is claimed with a
 * conditional update, the same discipline `fulfilOrder` uses, so a second
 * caller finds nothing left to claim rather than sending a second email.
 *
 * Two deliberate omissions. A licence that has *already* expired gets nothing —
 * "expires in -3 days" is worse than silence, and leaving its stamp null keeps
 * the miss visible rather than papering over it. And an unpaid order gets
 * nothing, because there is no licence to renew.
 */
export async function sendRenewalReminders(
  options: { now?: Date; limit?: number } = {},
): Promise<RenewalSweep> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 500;

  // Midnight-to-midnight in UTC, so a licence expiring today is included for
  // the whole of today rather than dropping out at the moment it was sold.
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const until = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + REMIND_DAYS_AHEAD,
      23,
      59,
      59,
      999,
    ),
  );

  const due = await prisma.orderItem.findMany({
    where: {
      expiresAt: { gte: from, lte: until },
      renewalRemindedAt: null,
      licenceKey: { not: null },
      order: { paymentStatus: "PAID" },
    },
    orderBy: { expiresAt: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      variantName: true,
      seats: true,
      qty: true,
      expiresAt: true,
      order: {
        select: {
          id: true,
          number: true,
          email: true,
          userId: true,
          user: { select: { name: true, phone: true, whatsappOptIn: true } },
        },
      },
      variant: { select: { product: { select: { slug: true } } } },
    },
  });

  const result: RenewalSweep = {
    due: due.length,
    reminded: 0,
    skipped: 0,
    failed: 0,
  };

  // One message per order per expiry date. Five lines bought together and
  // expiring together are one email, not five — a reminder that arrives five
  // times reads as a dunning letter.
  const groups = new Map<string, typeof due>();
  for (const item of due) {
    const key = `${item.order.id}:${item.expiresAt!.toISOString().slice(0, 10)}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  for (const group of groups.values()) {
    const ids = group.map((item) => item.id);
    const first = group[0];
    const expiresAt = first.expiresAt!;

    // The claim. Postgres serialises two runs on these rows, and the loser
    // re-reads the condition and matches nothing.
    const claimed = await prisma.orderItem.updateMany({
      where: { id: { in: ids }, renewalRemindedAt: null },
      data: { renewalRemindedAt: now },
    });
    if (claimed.count === 0) {
      result.skipped += 1;
      continue;
    }

    const slugs = new Set(
      group.map((item) => item.variant?.product.slug).filter(Boolean),
    );
    const renewUrl =
      slugs.size === 1
        ? `${appUrl()}/product/${[...slugs][0]}`
        : `${appUrl()}/s`;

    const summary =
      group.length === 1
        ? first.name
        : `${first.name} and ${group.length - 1} other ${group.length === 2 ? "licence" : "licences"}`;

    const licences = group
      .map((item) => {
        const seats = item.seats * item.qty;
        return `  • ${item.name} — ${item.variantName}${seats > 1 ? ` (${seats} seats)` : ""}`;
      })
      .join("\n");

    try {
      await notify(
        "licence.expiring",
        {
          userId: first.order.userId,
          orderId: first.order.id,
          email: first.order.email,
          phone: first.order.user.phone,
          whatsappOptIn: first.order.user.whatsappOptIn,
        },
        {
          name: first.order.user.name,
          number: first.order.number,
          summary,
          licences,
          expiresOn: formatExpiry(expiresAt),
          days: String(daysUntil(expiresAt, now)),
          renewUrl,
          accountUrl: `${appUrl()}/account/licences`,
        },
      );
      result.reminded += 1;
    } catch (error) {
      // The stamp goes back so the next run tries again. Better a reminder a
      // day late than a promise quietly dropped.
      await prisma.orderItem.updateMany({
        where: { id: { in: ids } },
        data: { renewalRemindedAt: null },
      });
      result.failed += 1;
      console.error(
        `[renewals] reminder for order ${first.order.number} failed`,
        error,
      );
    }
  }

  return result;
}
