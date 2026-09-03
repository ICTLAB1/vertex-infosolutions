import type { Metadata } from "next";
import Link from "next/link";

import { Status } from "@/app/admin/page";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoney } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Orders" };

const STATUSES = ["PENDING", "PAID", "REFUNDED", "FAILED"] as const;
const PAGE = 40;

/**
 * Every order, newest first.
 *
 * The search box takes an order number or an email address and nothing else —
 * those are the two things anybody has in front of them when a customer is on
 * the phone. It is a `contains` match, which is fine at this size and would
 * want an index the day it is not.
 */
export default async function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  await requireAdmin("/admin/orders");

  const params = (await props.searchParams) as Record<
    string,
    string | string[] | undefined
  >;
  const one = (key: string) =>
    (Array.isArray(params[key]) ? params[key][0] : params[key]) ?? "";

  const status = STATUSES.find((value) => value === one("status"));
  const query = one("q").trim();
  const page = Math.max(1, Number(one("page")) || 1);

  const where: Prisma.OrderWhereInput = {
    ...(status ? { paymentStatus: status } : {}),
    ...(query
      ? {
          OR: [
            { number: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { billName: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        number: true,
        createdAt: true,
        email: true,
        billName: true,
        country: true,
        currency: true,
        totalMinor: true,
        paymentStatus: true,
        paymentMethod: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const link = (changes: Record<string, string>) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (status) next.set("status", status);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const search = next.toString();
    return search ? `/admin/orders?${search}` : "/admin/orders";
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <h1 className="text-2xl font-bold text-ink">Orders</h1>

      <form className="mt-4 flex flex-wrap items-end gap-2" action="/admin/orders">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label className="block grow">
          <span className="block text-[13px] font-semibold text-ink">
            Order number, email or name
          </span>
          <input
            name="q"
            defaultValue={query}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-[14px]"
          />
        </label>
        <button
          type="submit"
          className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-link hover:bg-ground/60"
        >
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
        <Filter href={link({ status: "", page: "" })} active={!status} label="All" />
        {STATUSES.map((value) => (
          <Filter
            key={value}
            href={link({ status: value, page: "" })}
            active={status === value}
            label={value.charAt(0) + value.slice(1).toLowerCase()}
          />
        ))}
      </div>

      <p className="mt-3 text-[13px] text-muted">
        {total} {total === 1 ? "order" : "orders"}
        {query ? ` matching “${query}”` : ""}
        {status ? `, ${status.toLowerCase()}` : ""}.
      </p>

      {orders.length === 0 ? (
        <p className="mt-5 rounded-lg border border-line bg-surface p-8 text-center text-muted">
          Nothing matches.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[760px] text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] uppercase tracking-wide text-faint">
                <th className="px-4 py-2 font-semibold">Order</th>
                <th className="px-4 py-2 font-semibold">Placed</th>
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-4 py-2 font-semibold">Method</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {orders.map((order) => (
                <tr key={order.number} className="hover:bg-ground/40">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/orders/${order.number}`}
                      className="font-mono font-semibold text-link hover:underline"
                    >
                      {order.number}
                    </Link>
                    <span className="ml-2 text-[12px] text-faint">
                      {order._count.items}{" "}
                      {order._count.items === 1 ? "line" : "lines"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-muted tabular-nums">
                    {order.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block text-[13px] text-ink">{order.billName}</span>
                    <span className="block text-[12px] text-faint">
                      {order.email} · {order.country}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-muted">
                    {order.paymentMethod.replace("_", " ").toLowerCase()}
                  </td>
                  <td className="px-4 py-2.5">
                    <Status status={order.paymentStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {formatMoney(order.totalMinor, order.currency as CurrencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE ? (
        <div className="mt-4 flex items-center justify-between text-[13px]">
          {page > 1 ? (
            <Link href={link({ page: String(page - 1) })} className="text-link hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {Math.ceil(total / PAGE)}
          </span>
          {page * PAGE < total ? (
            <Link href={link({ page: String(page + 1) })} className="text-link hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}

function Filter({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-nav bg-nav font-semibold text-white"
          : "border-line bg-surface text-muted hover:bg-ground/60"
      }`}
    >
      {label}
    </Link>
  );
}
