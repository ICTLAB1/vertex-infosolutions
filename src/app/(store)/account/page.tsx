import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NOINDEX } from "@/lib/seo";
import { signOut } from "@/app/auth-actions";
import { isAdmin } from "@/lib/admin";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoney } from "@/lib/money";
import { REMIND_DAYS_AHEAD } from "@/lib/renewals";

export const metadata: Metadata = { title: "Your account", ...NOINDEX };

export default async function AccountPage(props: PageProps<"/account">) {
  const user = await getUser();
  if (!user) redirect("/signin?next=/account");
  if (!user.emailVerifiedAt) redirect("/verify");

  const params = (await props.searchParams) as Record<string, string | string[] | undefined>;
  const welcome = params.welcome === "1";

  // Anything already expired or inside the reminder window. The tile says so
  // rather than making somebody open the page to find out.
  const renewBy = new Date();
  renewBy.setUTCDate(renewBy.getUTCDate() + REMIND_DAYS_AHEAD);

  const [orders, keyCount, renewCount] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        number: true,
        createdAt: true,
        currency: true,
        totalMinor: true,
        paymentStatus: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.orderItem.count({
      where: { order: { userId: user.id }, licenceKey: { not: null } },
    }),
    prisma.orderItem.count({
      where: {
        order: { userId: user.id },
        licenceKey: { not: null },
        expiresAt: { not: null, lte: renewBy },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      {welcome ? (
        <p className="mb-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-[14px] text-ok">
          <span className="font-semibold">Your email is confirmed.</span> Your
          account is ready, and anything you buy will be delivered straight into it.
        </p>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Hello, {user.name}</h1>
          <p className="text-[14px] text-muted">{user.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-[14px] text-link hover:underline">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Tile
          href="/account/licences"
          title="Your licences"
          body={
            keyCount === 0
              ? "Keys appear here the moment an order is paid."
              : `${keyCount} ${keyCount === 1 ? "key" : "keys"}, kept permanently.`
          }
          flag={
            renewCount > 0
              ? `${renewCount} ${renewCount === 1 ? "needs" : "need"} renewing`
              : null
          }
        />
        <Tile
          href="/account/orders"
          title="Your orders"
          body="Invoices, payment status and licence keys, by order."
        />
        <Tile
          href="/account/profile"
          title="Profile & notifications"
          body="Name, phone number and WhatsApp updates."
        />
      </div>

      {isAdmin(user.email) ? (
        <p className="mt-3 text-[13px] text-muted">
          You can run the store:{" "}
          <Link href="/admin" className="text-link underline">
            the back office
          </Link>
          .
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-[16px] font-bold text-ink">Recent orders</h2>
          <Link href="/account/orders" className="text-[13px] text-link hover:underline">
            See all
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-[14px] text-muted">
            Nothing yet.{" "}
            <Link href="/s" className="text-link underline">
              Browse the catalogue
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {orders.map((order) => (
              <li key={order.number} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                <span>
                  <Link
                    href={`/account/orders/${order.number}`}
                    className="font-mono text-[14px] font-semibold text-ink hover:text-link hover:underline"
                  >
                    {order.number}
                  </Link>
                  <span className="ml-3 text-[13px] text-muted">
                    {order.createdAt.toISOString().slice(0, 10)} ·{" "}
                    {order._count.items} {order._count.items === 1 ? "licence" : "licences"}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                      order.paymentStatus === "PAID"
                        ? "bg-ok/10 text-ok"
                        : "bg-warn/10 text-warn"
                    }`}
                  >
                    {order.paymentStatus === "PAID" ? "Paid" : "Awaiting payment"}
                  </span>
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

function Tile({
  href,
  title,
  body,
  flag = null,
}: {
  href: string;
  title: string;
  body: string;
  /** Something that wants attention now, said in the tile rather than behind it. */
  flag?: string | null;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-line bg-surface p-4 transition-shadow hover:shadow-md"
    >
      <p className="text-[15px] font-bold text-ink">{title}</p>
      <p className="mt-0.5 text-[13px] text-muted">{body}</p>
      {flag ? (
        <p className="mt-1.5 inline-block rounded border border-warn/40 bg-warn/10 px-2 py-0.5 text-[12px] font-semibold text-warn">
          {flag}
        </p>
      ) : null}
    </Link>
  );
}
