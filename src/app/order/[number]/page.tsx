import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Glyph } from "@/components/glyph";
import { prisma } from "@/lib/db";
import { countryName, type CurrencyCode } from "@/lib/market";
import { formatMoneyExact } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, STATUS_LABELS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

/**
 * The confirmation, and afterwards the order's own page.
 *
 * The order number alone reaches this page, which is fine for a demo and not
 * fine in production — a real deployment gates it behind a signed link or an
 * account, because an order number is short enough to guess at, and licence
 * keys are on it.
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
      },
    },
  });

  if (!order) notFound();

  const currency = order.currency as CurrencyCode;
  const paid = order.paymentStatus === "PAID";
  const domestic = order.country === "IN";
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
            ? `Payment received. Your keys are below and a ${domestic ? "GST" : "commercial"} invoice is on its way to ${maskedEmail}.`
            : `We have emailed our bank details to ${maskedEmail}. Keys are issued once the funds clear.`}
        </p>
        <p className="mt-2 font-mono text-[14px] text-muted">
          Order {order.number}
        </p>
      </div>

      {order.fulfilments.map((fulfilment) => (
        <section
          key={fulfilment.id}
          className="mt-5 rounded-lg border border-line bg-surface p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-3">
            <h2 className="text-[16px] font-bold text-ink">
              Delivered by email
            </h2>
            <span className="rounded-full bg-ground px-3 py-1 text-[13px] font-semibold text-ink">
              {STATUS_LABELS[fulfilment.status] ?? fulfilment.status}
            </span>
          </div>

          <p className="mt-3 text-[14px] text-muted">
            {fulfilment.status === "ISSUED"
              ? "Your keys are below and have also been emailed to you. Keep them somewhere safe — they are the licence."
              : "Keys are issued once payment clears."}
          </p>

          <ul className="mt-3 divide-y divide-line-soft">
            {fulfilment.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-3">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-ground/60 text-nav-2">
                  <Glyph
                    name={item.variant?.product.glyph ?? "licence"}
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
                    {item.seats > 1
                      ? ` · ${item.seats * item.qty} seats`
                      : ""}
                  </p>
                  <p className="font-mono text-[12px] text-faint">
                    {item.sku}
                    {domestic && item.sacCode ? ` · SAC ${item.sacCode}` : ""}
                  </p>

                  {item.licenceKey ? (
                    <p className="mt-2 inline-block rounded border border-line bg-ground/60 px-3 py-1.5 font-mono text-[14px] font-medium text-ink">
                      {item.licenceKey}
                    </p>
                  ) : null}

                  <p className="mt-1.5 text-[12px] text-faint">
                    {item.licenceKey
                      ? "Not returnable — the key has been revealed."
                      : "Refundable in full until the key is issued."}
                  </p>
                </div>
                <span className="shrink-0 text-right text-[15px] font-semibold text-ink">
                  {formatMoneyExact(item.unitPriceMinor * item.qty, currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-4 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-[16px] font-bold text-ink">
          {domestic ? "Tax invoice" : "Commercial invoice"}
        </h2>

        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="text-[13px]">
            <p className="font-semibold text-ink">Billed to</p>
            <address className="mt-1 not-italic text-muted">
              {order.billName}
              {order.billCompany ? (
                <>
                  <br />
                  {order.billCompany}
                </>
              ) : null}
              {order.billCity ? (
                <>
                  <br />
                  {order.billCity}
                  {order.billRegion ? `, ${order.billRegion}` : ""}{" "}
                  {order.billPostcode ?? ""}
                </>
              ) : null}
              <br />
              {countryName(order.country)}
            </address>
            {order.gstin ? (
              <p className="mt-1 font-mono text-[12px] text-muted">
                GSTIN {order.gstin}
              </p>
            ) : null}
          </div>

          <dl className="space-y-1 text-[14px]">
            {domestic ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted">Taxable value</dt>
                  <dd>{formatMoneyExact(order.netMinor, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">
                    {order.taxLabel ?? "GST"} at {order.taxRatePercent}%
                  </dt>
                  <dd>{formatMoneyExact(order.taxMinor, currency)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <dt className="text-muted">Items</dt>
                <dd>{formatMoneyExact(order.netMinor, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line-soft pt-2 text-[17px] font-bold text-ink">
              <dt>Total</dt>
              <dd>
                {formatMoneyExact(order.totalMinor, currency)}{" "}
                <span className="text-[13px] font-normal text-faint">
                  {currency}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-3 border-t border-line-soft pt-2 text-[13px] text-muted">
          {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{" "}
          {paid ? "payment received" : "awaiting funds"}
          {domestic
            ? ""
            : " · zero-rated export of services; no Indian GST charged"}
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
