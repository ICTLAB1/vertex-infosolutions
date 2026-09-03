import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoney } from "@/lib/money";
import { REMIND_DAYS_AHEAD } from "@/lib/renewals";

export const metadata: Metadata = { title: "Overview" };

/**
 * What needs a person today.
 *
 * Not a metrics dashboard. Every number here is something somebody has to act
 * on — money that has not arrived, messages that did not send, licences about
 * to lapse — and each one is a link to the thing that needs doing. Revenue
 * charts belong somewhere that is not the first screen of a working tool.
 */
export default async function AdminHomePage() {
  await requireAdmin();

  const dayAgo = new Date();
  dayAgo.setUTCHours(dayAgo.getUTCHours() - 24);
  const renewBy = new Date();
  renewBy.setUTCDate(renewBy.getUTCDate() + REMIND_DAYS_AHEAD);

  const [awaiting, paidToday, failedMessages, expiring, unverified, recent] =
    await Promise.all([
      prisma.order.count({ where: { paymentStatus: "PENDING" } }),
      prisma.order.count({ where: { paidAt: { gte: dayAgo } } }),
      // Abandoned, not failed: a failed message is one the sweep will try
      // again. An abandoned one is where retrying stopped, and a person has to
      // decide what happens next.
      prisma.notification.count({ where: { status: "ABANDONED" } }),
      prisma.orderItem.count({
        where: {
          licenceKey: { not: null },
          expiresAt: { not: null, lte: renewBy },
          renewalRemindedAt: null,
        },
      }),
      prisma.user.count({ where: { emailVerifiedAt: null } }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          number: true,
          createdAt: true,
          email: true,
          currency: true,
          totalMinor: true,
          paymentStatus: true,
          country: true,
        },
      }),
    ]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <h1 className="text-2xl font-bold text-ink">Overview</h1>
      <p className="mt-1 text-[14px] text-muted">
        Everything below is something waiting on a person.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Count
          href="/admin/orders?status=PENDING"
          label="Awaiting payment"
          value={awaiting}
          note="Bank transfers to reconcile."
          urgent={awaiting > 0}
        />
        <Count
          href="/admin/activity"
          label="Messages given up on"
          value={failedMessages}
          note="Retried until it stopped being worth it. These need a person."
          urgent={failedMessages > 0}
        />
        <Count
          href="/admin/orders?status=PAID"
          label="Paid in 24 hours"
          value={paidToday}
          note="Keys issued automatically."
        />
        <Count
          label="Reminders due"
          value={expiring}
          note={`Licences expiring within ${REMIND_DAYS_AHEAD} days that the sweep has not reminded.`}
          urgent={expiring > 0}
        />
      </div>

      <p className="mt-3 text-[13px] text-muted">
        {unverified} {unverified === 1 ? "account has" : "accounts have"} never
        confirmed an email address. They cannot buy anything until they do.
      </p>

      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-[16px] font-bold text-ink">Latest orders</h2>
          <Link href="/admin/orders" className="text-[13px] text-link hover:underline">
            All orders
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-[14px] text-muted">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {recent.map((order) => (
              <li
                key={order.number}
                className="flex flex-wrap items-baseline justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <Link
                    href={`/admin/orders/${order.number}`}
                    className="font-mono text-[14px] font-semibold text-ink hover:text-link hover:underline"
                  >
                    {order.number}
                  </Link>
                  <span className="ml-3 text-[13px] text-muted">
                    {order.createdAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                    {order.email} · {order.country}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <Status status={order.paymentStatus} />
                  <span className="text-[14px] font-semibold text-ink">
                    {formatMoney(order.totalMinor, order.currency as CurrencyCode)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Count({
  href,
  label,
  value,
  note,
  urgent = false,
}: {
  href?: string;
  label: string;
  value: number;
  note: string;
  urgent?: boolean;
}) {
  const body = (
    <>
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p
        className={`mt-0.5 text-[28px] font-bold tabular-nums ${
          urgent && value > 0 ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-faint">{note}</p>
    </>
  );

  const className = `rounded-lg border bg-surface p-4 ${
    urgent && value > 0 ? "border-warn/40" : "border-line"
  }`;

  return href ? (
    <Link href={href} className={`${className} block transition-shadow hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Status({ status }: { status: string }) {
  const tone =
    status === "PAID"
      ? "bg-ok/10 text-ok"
      : status === "PENDING"
        ? "bg-warn/10 text-warn"
        : "bg-deal/10 text-deal";
  const label =
    status === "PAID"
      ? "Paid"
      : status === "PENDING"
        ? "Awaiting payment"
        : status === "REFUNDED"
          ? "Refunded"
          : "Failed";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tone}`}>
      {label}
    </span>
  );
}
