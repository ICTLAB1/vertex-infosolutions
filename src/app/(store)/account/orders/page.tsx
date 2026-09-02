import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Your orders", robots: { index: false } };

export default async function OrdersPage() {
  const user = await getUser();
  if (!user) redirect("/signin?next=/account/orders");
  if (!user.emailVerifiedAt) redirect("/verify");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      number: true,
      createdAt: true,
      currency: true,
      totalMinor: true,
      paymentStatus: true,
      country: true,
      items: { select: { name: true, variantName: true } },
    },
  });

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6">
      <nav className="mb-3 text-[13px] text-muted">
        <Link href="/account" className="hover:text-link hover:underline">
          Your account
        </Link>
        <span className="px-1.5">›</span>
        <span className="text-ink">Orders</span>
      </nav>

      <h1 className="text-2xl font-bold text-ink">Your orders</h1>

      {orders.length === 0 ? (
        <div className="mt-5 rounded-lg border border-line bg-surface p-10 text-center">
          <p className="text-lg font-semibold text-ink">No orders yet</p>
          <Link
            href="/s"
            className="btn-amber mt-4 inline-block rounded-full px-5 py-2 font-semibold"
          >
            Browse the catalogue
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((order) => (
            <li key={order.number} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft pb-2">
                <span>
                  <Link
                    href={`/account/orders/${order.number}`}
                    className="font-mono text-[15px] font-semibold text-ink hover:text-link hover:underline"
                  >
                    {order.number}
                  </Link>
                  <span className="ml-3 text-[13px] text-muted">
                    {order.createdAt.toISOString().slice(0, 10)}
                  </span>
                  <a
                    href={`/account/orders/${order.number}/invoice`}
                    target="_blank"
                    rel="noopener"
                    className="ml-3 text-[13px] text-link hover:underline"
                  >
                    {order.country === "IN" ? "GST invoice" : "Commercial invoice"}{" "}
                    (PDF)
                  </a>
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
                  <span className="text-[15px] font-bold text-ink">
                    {formatMoney(order.totalMinor, order.currency as CurrencyCode)}
                  </span>
                </span>
              </div>
              <ul className="mt-2 text-[13px] text-muted">
                {order.items.map((item, index) => (
                  <li key={index}>
                    {item.name} — {item.variantName}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
