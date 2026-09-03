import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Status } from "@/app/admin/page";
import {
  MarkPaidForm,
  ResendKeysForm,
  ResendPendingForm,
} from "@/components/admin-forms";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { countryName, type CurrencyCode } from "@/lib/market";
import { formatMoneyExact } from "@/lib/money";
import { expiryLabel } from "@/lib/renewals";

export const metadata: Metadata = { title: "Order" };

/**
 * One order, and the three things a person can do to it.
 *
 * The licence keys are shown in full. An administrator who can mark an order
 * paid and re-send its keys can already see them; masking them here would only
 * stop support reading one back to a customer on the phone, which is the
 * commonest reason to open this page.
 */
export default async function AdminOrderPage(
  props: PageProps<"/admin/orders/[number]">,
) {
  const { number } = await props.params;
  await requireAdmin(`/admin/orders/${number}`);

  const params = (await props.searchParams) as Record<
    string,
    string | string[] | undefined
  >;
  const recorded = params.recorded === "1";

  const order = await prisma.order.findUnique({
    where: { number },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, whatsappOptIn: true, emailVerifiedAt: true } },
      items: true,
      fulfilments: true,
    },
  });
  if (!order) notFound();

  const currency = order.currency as CurrencyCode;
  const paid = order.paymentStatus === "PAID";

  // `Notification` carries an order id but no relation to `Order` — it also
  // records messages that belong to an account rather than an order, like a
  // one-time code. So it is queried rather than included.
  const [notifications, history] = await Promise.all([
    prisma.notification.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.adminAction.findMany({
      where: { subject: number },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <nav className="mb-3 text-[13px] text-muted">
        <Link href="/admin/orders" className="hover:text-link hover:underline">
          Orders
        </Link>
        <span className="px-1.5">›</span>
        <span className="font-mono text-ink">{order.number}</span>
      </nav>

      {recorded ? (
        <p className="mb-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-[14px] text-ok">
          <span className="font-semibold">Payment recorded.</span> Licence keys
          have been issued and sent to {order.email}, and the reference is on
          the record below.
        </p>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold text-ink">{order.number}</h1>
        <div className="flex items-center gap-3">
          <Status status={order.paymentStatus} />
          <span className="text-[18px] font-bold text-ink">
            {formatMoneyExact(order.totalMinor, currency)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Panel title="Lines">
            <ul className="divide-y divide-line-soft">
              {order.items.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">{item.name}</span>
                    <span className="font-semibold tabular-nums text-ink">
                      {formatMoneyExact(item.unitPriceMinor * item.qty, currency)}
                    </span>
                  </div>
                  <p className="text-[13px] text-muted">
                    {item.variantName} · {item.sku} · quantity {item.qty}
                    {item.sacCode ? ` · SAC ${item.sacCode}` : ""}
                  </p>
                  {item.licenceKey ? (
                    <p className="mt-1.5 inline-block rounded border border-line bg-ground/60 px-2.5 py-1 font-mono text-[13px] text-ink">
                      {item.licenceKey}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[13px] text-warn">
                      No key issued yet.
                    </p>
                  )}
                  {item.expiresAt ? (
                    <p className="mt-1 text-[12px] text-faint">
                      {expiryLabel(item.expiresAt)}
                      {item.renewalRemindedAt
                        ? ` · reminded ${item.renewalRemindedAt.toISOString().slice(0, 10)}`
                        : " · not yet reminded"}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-[14px]">
              <Row label={order.taxMinor > 0 ? "Taxable value" : "Subtotal"}>
                {formatMoneyExact(order.netMinor, currency)}
              </Row>
              <Row
                label={
                  order.taxMinor > 0
                    ? `${order.taxLabel ?? "GST"} at ${order.taxRatePercent}%`
                    : "Tax (zero-rated export)"
                }
              >
                {formatMoneyExact(order.taxMinor, currency)}
              </Row>
              <Row label="Total" strong>
                {formatMoneyExact(order.totalMinor, currency)}
              </Row>
            </dl>
          </Panel>

          <Panel title="Messages sent">
            {notifications.length === 0 ? (
              <p className="text-[14px] text-muted">Nothing sent yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft text-[13px]">
                {notifications.map((message) => (
                  <li key={message.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
                    <span className="font-mono text-[12px] text-faint tabular-nums">
                      {message.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                    <span className="font-semibold text-ink">{message.template}</span>
                    <span className="text-muted">
                      {message.channel.toLowerCase()} → {message.destination}
                    </span>
                    <span
                      className={
                        message.status === "SENT"
                          ? "text-ok"
                          : message.status === "FAILED"
                            ? "text-deal"
                            : "text-faint"
                      }
                    >
                      {message.status.toLowerCase()}
                      {message.error ? `: ${message.error}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {history.length > 0 ? (
            <Panel title="Changed by hand">
              <ul className="divide-y divide-line-soft text-[13px]">
                {history.map((entry) => (
                  <li key={entry.id} className="py-2">
                    <span className="font-mono text-[12px] text-faint tabular-nums">
                      {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </span>{" "}
                    <span className="font-semibold text-ink">{entry.actorEmail}</span>
                    <p className="text-muted">{entry.detail}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel title="Customer">
            <dl className="space-y-1 text-[14px]">
              <Row label="Name">{order.billName}</Row>
              {order.billCompany ? <Row label="Company">{order.billCompany}</Row> : null}
              <Row label="Email">{order.email}</Row>
              <Row label="Phone">{order.phone}</Row>
              <Row label="Country">{countryName(order.country)}</Row>
              {order.gstin ? <Row label="GSTIN">{order.gstin}</Row> : null}
              <Row label="Verified">
                {order.user.emailVerifiedAt ? "yes" : "no"}
              </Row>
              <Row label="WhatsApp">
                {order.user.whatsappOptIn ? "opted in" : "not opted in"}
              </Row>
            </dl>
          </Panel>

          <Panel title="Payment">
            <dl className="space-y-1 text-[14px]">
              <Row label="Method">{order.paymentMethod.replace("_", " ").toLowerCase()}</Row>
              <Row label="Placed">
                {order.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </Row>
              {order.paidAt ? (
                <Row label="Paid">
                  {order.paidAt.toISOString().slice(0, 16).replace("T", " ")}
                </Row>
              ) : null}
              {order.stripePaymentIntentId ? (
                <Row label="Stripe">
                  <span className="font-mono text-[12px]">
                    {order.stripePaymentIntentId}
                  </span>
                </Row>
              ) : null}
            </dl>
            <p className="mt-3 border-t border-line-soft pt-3">
              <a
                href={`/account/orders/${order.number}/invoice`}
                target="_blank"
                rel="noopener"
                className="text-[13px] text-link hover:underline"
              >
                The customer&rsquo;s invoice (PDF)
              </a>
            </p>
          </Panel>

          {paid ? (
            <Panel title="Send the keys again">
              <ResendKeysForm number={order.number} email={order.email} />
            </Panel>
          ) : (
            <>
              <Panel title="Record a bank transfer">
                <MarkPaidForm number={order.number} />
              </Panel>
              <Panel title="Chase the payment">
                <ResendPendingForm number={order.number} />
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-2 text-[15px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  strong = false,
  children,
}: {
  label: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? "font-bold text-ink" : "text-muted"}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-bold text-ink" : "text-ink"}`}>
        {children}
      </dd>
    </div>
  );
}
