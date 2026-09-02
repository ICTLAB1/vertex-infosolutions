import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/checkout-form";
import { getCart, getMarket, totalsFor } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { methodsFor } from "@/lib/types";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const [cart, market] = await Promise.all([getCart(), getMarket()]);
  if (!cart || cart.items.length === 0) redirect("/cart");

  const totals = totalsFor(cart.items, market);
  // Something priced in the other market cannot be checked out. The cart page
  // says which line and offers to remove it.
  if (totals.unpriced > 0) redirect("/cart");

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Checkout</h1>
        <Link href="/cart" className="text-[14px] text-link hover:underline">
          Back to cart
        </Link>
      </div>

      {/* The totals are restated here, in full, before anything is entered.
          Nothing is added between this panel and the confirmation. */}
      <div className="mb-5 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-[15px] font-bold text-ink">
          What you are paying for
        </h2>
        <ul className="mt-2 divide-y divide-line-soft text-[14px]">
          {cart.items.map((line) => {
            const price = line.variant.prices.find(
              (p) => p.currency === totals.currency,
            );
            return (
              <li key={line.id} className="flex justify-between gap-4 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-ink">
                    {line.variant.product.name}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {line.variant.name} · quantity {line.qty}
                    {line.variant.seats > 1
                      ? ` · ${line.variant.seats * line.qty} seats total`
                      : ""}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-ink">
                  {price
                    ? formatMoney(price.priceMinor * line.qty, totals.currency)
                    : "—"}
                </span>
              </li>
            );
          })}
        </ul>

        <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-[14px]">
          {market.domestic ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted">Taxable value</dt>
                <dd>{formatMoney(totals.netMinor, totals.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">
                  GST at {totals.taxRatePercent}%
                </dt>
                <dd>{formatMoney(totals.taxMinor, totals.currency)}</dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <dt className="text-muted">Items</dt>
              <dd>{formatMoney(totals.totalMinor, totals.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line-soft pt-2 text-[17px] font-bold text-ink">
            <dt>Total</dt>
            <dd>
              {formatMoney(totals.totalMinor, totals.currency)}{" "}
              <span className="text-[13px] font-normal text-faint">
                {totals.currency}
              </span>
            </dd>
          </div>
          <p className="text-[12px] text-faint">
            {market.domestic
              ? "This is the final amount, GST included. Nothing is added on the next screen."
              : "This is the final amount. No Indian tax applies to an export; any tax your own country charges on imported software is not included here."}
          </p>
        </dl>
      </div>

      <CheckoutForm
        methods={methodsFor(totals.currency)}
        total={formatMoney(totals.totalMinor, totals.currency)}
        currency={totals.currency}
        domestic={market.domestic}
      />
    </div>
  );
}
