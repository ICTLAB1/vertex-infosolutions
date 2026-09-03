import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/admin-forms";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoney } from "@/lib/money";

import { signOutCustomer, verifyCustomerEmail } from "../../admin-actions";

export const metadata: Metadata = { title: "Customer" };

/**
 * Everything about one customer, on one page.
 *
 * Assembled so the questions a support call actually opens with — can they
 * buy, what did they order, did the email reach them, who is signed in — are
 * answered without navigating anywhere. Licence keys are deliberately not
 * shown: an administrator can re-send them to the customer, which is the
 * legitimate need, and cannot read them off the screen, which is not.
 */
export default async function CustomerPage(
  props: PageProps<"/admin/customers/[id]">,
) {
  await requireAdmin("/admin/customers");
  const { id } = await props.params;

  const customer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      whatsappOptIn: true,
      emailVerifiedAt: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          number: true,
          createdAt: true,
          currency: true,
          totalMinor: true,
          paymentStatus: true,
        },
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, expiresAt: true, userAgent: true },
      },
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          channel: true,
          template: true,
          status: true,
          destination: true,
          error: true,
        },
      },
    },
  });
  if (!customer) notFound();

  const live = customer.sessions.filter((s) => s.expiresAt > new Date());

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <Link href="/admin/customers" className="text-[13px] text-link hover:underline">
        ← All customers
      </Link>

      <h1 className="mt-2 text-xl font-bold text-ink">{customer.email}</h1>
      <p className="text-[14px] text-muted">
        {customer.name} · joined {customer.createdAt.toISOString().slice(0, 10)}
        {customer.phone ? ` · ${customer.phone}` : " · no phone"}
        {customer.whatsappOptIn ? " · WhatsApp opted in" : ""}
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-[15px] font-bold text-ink">
              Orders ({customer.orders.length})
            </h2>
            {customer.orders.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted">Nothing bought yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line-soft text-[14px]">
                {customer.orders.map((order) => (
                  <li key={order.number} className="flex justify-between gap-3 py-2">
                    <Link
                      href={`/admin/orders/${order.number}`}
                      className="font-semibold text-link hover:underline"
                    >
                      {order.number}
                    </Link>
                    <span className="text-muted">
                      {order.createdAt.toISOString().slice(0, 10)} ·{" "}
                      {order.paymentStatus}
                    </span>
                    <span className="font-semibold tabular-nums text-ink">
                      {formatMoney(order.totalMinor, order.currency as CurrencyCode)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-[15px] font-bold text-ink">Recent messages</h2>
            {customer.notifications.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted">Nothing sent yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line-soft text-[13px]">
                {customer.notifications.map((message) => (
                  <li key={message.id} className="py-2">
                    <span className="font-mono">{message.template}</span>{" "}
                    <span className="text-muted">
                      → {message.destination} ·{" "}
                      {message.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </span>{" "}
                    <span
                      className={
                        message.status === "SENT"
                          ? "font-semibold text-ok"
                          : message.status === "SKIPPED"
                            ? "text-muted"
                            : "font-semibold text-deal"
                      }
                    >
                      {message.status}
                    </span>
                    {message.error ? (
                      <p className="text-[12px] text-deal">{message.error}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-[15px] font-bold text-ink">Email address</h2>
            {customer.emailVerifiedAt ? (
              <p className="mt-1 text-[14px] text-ok">
                Confirmed {customer.emailVerifiedAt.toISOString().slice(0, 10)}.
              </p>
            ) : (
              <>
                <p className="mt-1 text-[14px] text-warn">
                  Not confirmed. They cannot buy anything until it is.
                </p>
                <div className="mt-3">
                  <ActionForm
                    action={verifyCustomerEmail}
                    fields={{ userId: customer.id }}
                    label="Confirm it by hand"
                    busy="Confirming…"
                    note="For when the code cannot reach them. Recorded against your name."
                  />
                </div>
              </>
            )}
          </section>

          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-[15px] font-bold text-ink">
              Sessions ({live.length} active)
            </h2>
            {live.length === 0 ? (
              <p className="mt-1 text-[14px] text-muted">Not signed in anywhere.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-[12px] text-muted">
                {live.slice(0, 5).map((session) => (
                  <li key={session.id}>
                    {session.createdAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                    {session.userAgent?.slice(0, 60) ?? "unknown browser"}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <ActionForm
                action={signOutCustomer}
                fields={{ userId: customer.id }}
                label="Sign out everywhere"
                busy="Ending sessions…"
                tone="loud"
                note="For a customer who thinks somebody else is in their account."
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
