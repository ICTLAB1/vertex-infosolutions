import type { Metadata } from "next";
import Link from "next/link";

import { NOINDEX } from "@/lib/seo";
import { removeFromCart, setQty } from "@/app/actions";
import { Glyph } from "@/components/glyph";
import { QtyInput } from "@/components/qty-input";
import { TenantNotice } from "@/components/tenant-notice";
import { BulkQuoteBanner } from "@/components/bulk-quote";
import { deliveryShort } from "@/lib/delivery";
import {
  getCart,
  getMarket,
  MAX_QTY,
  totalsFor,
  type CartLine,
} from "@/lib/cart";
import { TERM_LABELS } from "@/lib/catalogue";
import type { CurrencyCode } from "@/lib/market";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Your cart", ...NOINDEX };

export default async function CartPage() {
  const [cart, market] = await Promise.all([getCart(), getMarket()]);
  const lines = cart?.items ?? [];

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-[1500px] px-4 py-8">
        <div className="rounded-lg border border-line bg-surface p-10 text-center">
          <h1 className="text-2xl font-bold text-ink">Your cart is empty</h1>
          <p className="mt-2 text-muted">
            Nothing here yet. The catalogue is a good place to start.
          </p>
          <Link
            href="/s"
            className="btn-amber mt-5 inline-block rounded-full px-6 py-2.5 font-semibold"
          >
            Browse licences
          </Link>
        </div>
      </div>
    );
  }

  const totals = totalsFor(lines, market);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <h1 className="text-2xl font-bold text-ink">Shopping cart</h1>
          <p className="mt-1 border-b border-line-soft pb-3 text-[13px] text-muted">
            {market.domestic
              ? "Prices in INR, inclusive of GST. Everything here is delivered by email."
              : "Prices in USD. Everything here is delivered by email — no shipment, no customs."}
          </p>

          {/* The market is fixed while there is something in the basket, so the
              total cannot move under the customer between here and payment. */}
          <p className="mt-3 rounded-md border border-line bg-ground/50 px-3 py-2 text-[13px] text-muted">
            This cart is priced in{" "}
            <span className="font-semibold text-ink">{totals.currency}</span>.
            To change market, empty the cart first — we will not reprice
            something you have already decided to buy.
          </p>

          <ul className="mt-2 divide-y divide-line-soft">
            {lines.map((line) => (
              <CartRow
                key={line.id}
                line={line}
                currency={totals.currency}
                domestic={market.domestic}
              />
            ))}
          </ul>

          <p className="mt-4 border-t border-line-soft pt-3 text-right text-[15px]">
            Subtotal ({totals.count} {totals.count === 1 ? "item" : "items"}):{" "}
            <span className="text-xl font-bold text-ink">
              {formatMoney(totals.totalMinor, totals.currency)}
            </span>
          </p>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-4">
            <dl className="space-y-1.5 text-[14px]">
              {market.domestic ? (
                <>
                  <Row
                    label="Taxable value"
                    value={formatMoney(totals.netMinor, totals.currency)}
                  />
                  <Row
                    label={`GST at ${totals.taxRatePercent}%`}
                    value={formatMoney(totals.taxMinor, totals.currency)}
                  />
                </>
              ) : (
                <>
                  <Row
                    label={`Items (${totals.count})`}
                    value={formatMoney(totals.totalMinor, totals.currency)}
                  />
                  <Row label="Indian tax" value="None — export" />
                </>
              )}
              <Row label="Delivery" value="By email, free" />
              <div className="flex justify-between border-t border-line-soft pt-2 text-[18px] font-bold text-ink">
                <dt>Order total</dt>
                <dd>{formatMoney(totals.totalMinor, totals.currency)}</dd>
              </div>
            </dl>

            {totals.overCeiling ? (
              <p
                role="alert"
                className="mt-3 rounded-md border border-deal/40 bg-deal/5 p-2.5 text-[13px] text-deal"
              >
                This order is too large to place online. Reduce the quantities,
                or{" "}
                <Link href="/contact" className="underline">
                  ask us for a quote
                </Link>{" "}
                and we will invoice you directly.
              </p>
            ) : totals.unavailable > 0 ? (
              <p
                role="alert"
                className="mt-3 rounded-md border border-deal/40 bg-deal/5 p-2.5 text-[13px] text-deal"
              >
                {totals.unavailable === 1
                  ? "One item above cannot be bought as it stands. Remove it to continue."
                  : `${totals.unavailable} items above cannot be bought as they stand. Remove them to continue.`}
              </p>
            ) : (
              <Link
                href="/checkout"
                className="btn-amber mt-4 block rounded-full py-2.5 text-center text-[15px] font-semibold"
              >
                Proceed to checkout
              </Link>
            )}

            <BulkQuoteBanner className="mt-4" />

            <p className="mt-2 text-center text-[12px] text-faint">
              Card details are entered on the payment provider&apos;s own page.
              We never see them.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function CartRow({
  line,
  currency,
  domestic,
}: {
  line: CartLine;
  currency: CurrencyCode;
  domestic: boolean;
}) {
  const { variant } = line;
  const product = variant.product;
  const gone = !product.published || product.quoteOnly;
  const price = gone
    ? undefined
    : variant.prices.find((p) => p.currency === currency);

  return (
    <li className="flex gap-4 py-4">
      <Link
        href={`/product/${product.slug}`}
        className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-ground/60 text-nav-2"
      >
        <Glyph name={product.glyph} className="h-12 w-12" />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          {product.brand.name}
        </p>
        <Link
          href={`/product/${product.slug}?sku=${variant.sku}`}
          className="text-[15px] font-semibold text-ink hover:text-link hover:underline"
        >
          {product.name}
        </Link>
        <p className="text-[13px] text-muted">
          {variant.name} · {TERM_LABELS[product.term]}
        </p>
        <p className="mt-0.5 font-mono text-[12px] text-faint">{variant.sku}</p>
        {product.cspNewTenant && <TenantNotice tone="line" />}

        {gone ? (
          // Withdrawn while it sat in the basket. Said plainly, with the way
          // to still get it, rather than the line vanishing overnight and the
          // customer wondering what they did.
          <p className="mt-1 text-[13px] text-deal">
            No longer on sale here — remove it to check out.{" "}
            <Link
              href={`/contact?about=quote&product=${product.slug}`}
              className="underline"
            >
              Ask us for it
            </Link>{" "}
            and we can usually still supply it.
          </p>
        ) : price ? (
          <p className="mt-1 text-[13px] text-ok">
            {deliveryShort(product.cspNewTenant)}
            {domestic ? " · GST invoice included" : ""}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-deal">
            Not sold in {currency} — remove this to check out.
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <form action={setQty} className="flex items-center gap-2">
            <input type="hidden" name="itemId" value={line.id} />
            <QtyInput
              id={`qty-${line.id}`}
              name="qty"
              defaultValue={line.qty}
              max={MAX_QTY}
              label={`Quantity for ${product.name}`}
            />
          </form>
          <form action={removeFromCart}>
            <input type="hidden" name="itemId" value={line.id} />
            <button
              type="submit"
              className="text-[13px] text-link hover:underline"
            >
              Remove
            </button>
          </form>
        </div>
      </div>

      <div className="shrink-0 text-right">
        {price ? (
          <>
            <p className="text-[16px] font-bold text-ink">
              {formatMoney(price.priceMinor * line.qty, currency)}
            </p>
            {line.qty > 1 ? (
              <p className="text-[12px] text-faint">
                {formatMoney(price.priceMinor, currency)} each
              </p>
            ) : null}
            {variant.seats > 1 ? (
              <p className="text-[12px] text-faint">
                {variant.seats * line.qty} seats
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-faint">—</p>
        )}
      </div>
    </li>
  );
}
