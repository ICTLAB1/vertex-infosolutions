import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Customers" };

/**
 * Who has an account, and which of them needs something.
 *
 * Ordered by most recent first, because the customer somebody is asking about
 * is almost always one who did something today. The search is a plain
 * case-insensitive contains on address and name — the thing a person types
 * when they have half an email address from a phone call.
 */
export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  await requireAdmin("/admin/customers");
  const params = (await props.searchParams) as Record<string, string | undefined>;
  const q = (params.q ?? "").trim();

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        emailVerifiedAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">Customers</h1>
        <p className="text-[13px] text-muted">
          {total} account{total === 1 ? "" : "s"}
          {customers.length < total ? ` · showing the newest ${customers.length}` : ""}
        </p>
      </div>

      <form action="/admin/customers" className="mt-3 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by email or name"
          className="w-full max-w-sm rounded-md border border-line bg-surface px-3 py-2 text-[14px]"
        />
        <button
          type="submit"
          className="rounded-md border border-line bg-surface px-4 py-2 text-[14px] font-semibold"
        >
          Search
        </button>
        {q ? (
          <Link
            href="/admin/customers"
            className="self-center text-[13px] text-link underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-[14px]">
          <thead className="border-b border-line-soft text-left text-[12px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Confirmed</th>
              <th className="px-3 py-2">Orders</th>
              <th className="px-3 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  {q ? "Nobody matched that." : "No accounts yet."}
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="font-semibold text-link hover:underline"
                    >
                      {customer.email}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{customer.name}</td>
                  <td className="px-3 py-2">
                    {customer.emailVerifiedAt ? (
                      <span className="text-ok">Yes</span>
                    ) : (
                      <span className="text-warn">Not yet</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{customer._count.orders}</td>
                  <td className="px-3 py-2 text-muted">
                    {customer.createdAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
