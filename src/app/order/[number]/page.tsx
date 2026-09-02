import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Glyph } from "@/components/glyph";
import { prisma } from "@/lib/db";
import { formatMoney, formatMoneyExact } from "@/lib/money";
import { countryName, formatDay } from "@/lib/shipping";
import { PAYMENT_METHOD_LABELS, STATUS_LABELS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

/**
 * The confirmation, and afterwards the order's own page.
 *
 * A mixed order is shown as what it is: one payment, and beneath it each
 * fulfilment with its own state. A shipment still clearing customs next to a
 * licence already in the customer's inbox is the normal case here, not an error
 * state to explain away.
 *
 * The order number alone reaches this page, which is fine for a demo and not
 * fine in production — a real deployment gates it behind a signed link or an
 * account, because an order number is short enough to guess at.
 */
export default async function OrderPage(props: PageProps<"/order/[number]">) {
  const { number } = await props.params;

  const order = await prisma.order.findUnique({
    where: { number },
    include: {
      fulfilments: {
        include: {
          items: { include: { variant: { include: { product: true } } } },
        },
        orderBy: { kind: "asc" },
      },
    },
  });

  if (!order) notFound();

  const paid = order.paymentStatus === "PAID";
  const maskedEmail = order.email.replace(
    /^(.)(.*)(@.*)$/,
    (_, first: string, middle: string, domain: string) =>
      `${first}${"•".repeat(Math.min(middle.length, 6))}${domain}`,
  );

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6">
      <div className="rounded-lg border border-ok/30 bg-ok/5 p-5">
        <h1 className="text-2xl font-bold text-ok">
          {paid ? "Order confirmed" : "Order placed"}
        </h1>
        <p className="mt-1 text-[15px] text-ink">
          {paid
            ? `Payment received. A commercial invoice is on its way to ${maskedEmail}.`
            : `We have emailed our bank details to ${maskedEmail}. The order is prepared once the funds clear.`}
        </p>
        <p className="mt-2 font-mono text-[14px] text-muted">
          Order {order.number}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {order.fulfilments.map((fulfilment) => {
          const isShipment = fulfilment.kind === "SHIPMENT";
          return (
            <section
              key={fulfilment.id}
              className="rounded-lg border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-3">
                <h2 className="text-[16px] font-bold text-ink">
                  {isShipment ? "Shipped to you" : "Delivered by email"}
                </h2>
                <span className="rounded-full bg-ground px-3 py-1 text-[13px] font-semibold text-ink">
                  {STATUS_LABELS[fulfilment.status] ?? fulfilment.status}
                </span>
              </div>

              {isShipment ? (
                <div className="mt-3 text-[14px]">
                  {fulfilment.promisedFrom && fulfilment.promisedBy ? (
                    <p className="text-ink">
                      Arriving between{" "}
                      <span className="font-semibold">
                        {formatDay(fulfilment.promisedFrom)}
                      </span>{" "}
                      and{" "}
                      <span className="font-semibold">
                        {formatDay(fulfilment.promisedBy)}
                      </span>
                    </p>
                  ) : null}
                  {order.shipName ? (
                    <address className="mt-2 not-italic text-muted">
                      {order.shipName}
                      <br />
                      {order.shipLine1}
                      {order.shipLine2 ? (
                        <>
                          <br />
                          {order.shipLine2}
                        </>
                      ) : null}
                      <br />
                      {order.shipCity}
                      {order.shipRegion ? `, ${order.shipRegion}` : ""}{" "}
                      {order.shipPostcode}
                      <br />
                      {order.shipCountry
                        ? countryName(order.shipCountry)
                        : null}
                    </address>
                  ) : null}
                  {fulfilment.trackingRef ? (
                    <p className="mt-2 text-muted">
                      {fulfilment.carrier} ·{" "}
                      <span className="font-mono">{fulfilment.trackingRef}</span>
                      {fulfilment.trackingUrl ? (
                        <>
                          {" · "}
                          <a
                            href={fulfilment.trackingUrl}
                            className="text-link underline"
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            Track
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-2 text-[13px] text-muted">
                      A tracking number appears here once the parcel is handed
                      to the carrier.
                    </p>
                  )}
                  <p className="mt-2 text-[13px] text-muted">
                    Import duty and taxes are charged by{" "}
                    {order.shipCountry
                      ? countryName(order.shipCountry)
                      : "your country"}{" "}
                    and collected by the carrier before delivery. They are not
                    part of the total below.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[14px] text-muted">
                  {fulfilment.status === "ISSUED"
                    ? "Your keys are below and have also been emailed to you."
                    : "Keys are issued once payment clears."}
                </p>
              )}

              <ul className="mt-3 divide-y divide-line-soft">
                {fulfilment.items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-3">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-ground/60 text-nav-2">
                      <Glyph
                        name={item.variant?.product.glyph ?? "box"}
                        className="h-10 w-10"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      {item.variant ? (
                        <Link
                          href={`/product/${item.variant.product.slug}`}
                          className="text-[15px] font-semibold text-ink hover:text-link hover:underline"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <span className="text-[15px] font-semibold text-ink">
                          {item.name}
                        </span>
                      )}
                      <p className="text-[13px] text-muted">
                        {item.variantName} · quantity {item.qty}
                      </p>
                      <p className="font-mono text-[12px] text-faint">
                        {item.sku}
                        {item.hsCode ? ` · HS ${item.hsCode}` : ""}
                        {item.origin ? ` · origin ${item.origin}` : ""}
                      </p>

                      {item.licenceKey ? (
                        <p className="mt-2 inline-block rounded border border-line bg-ground/60 px-3 py-1.5 font-mono text-[14px] font-medium text-ink">
                          {item.licenceKey}
                        </p>
                      ) : null}

                      <p className="mt-1.5 text-[12px] text-faint">
                        {item.returnable
                          ? "Returnable within 14 days of delivery, unopened and undamaged."
                          : "Not returnable — the licence key has been revealed."}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-[15px] font-semibold text-ink">
                      {formatMoney(
                        item.unitPriceMinor * item.qty,
                        order.currency,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-4 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-[16px] font-bold text-ink">Payment</h2>
        <dl className="mt-2 space-y-1 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-muted">Items</dt>
            <dd>{formatMoneyExact(order.itemsMinor, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Shipping</dt>
            <dd>
              {order.shippingMinor === 0
                ? "Free"
                : formatMoneyExact(order.shippingMinor, order.currency)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line-soft pt-2 text-[17px] font-bold text-ink">
            <dt>Total</dt>
            <dd>
              {formatMoneyExact(order.totalMinor, order.currency)}{" "}
              <span className="text-[13px] font-normal text-faint">
                {order.currency}
              </span>
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[13px] text-muted">
          {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{" "}
          {paid ? "payment received" : "awaiting funds"}
        </p>
      </section>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/s"
          className="btn-amber rounded-full px-5 py-2.5 text-[14px] font-semibold"
        >
          Continue shopping
        </Link>
        <Link
          href="/orders"
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink hover:bg-ground"
        >
          Find another order
        </Link>
      </div>
    </div>
  );
}
