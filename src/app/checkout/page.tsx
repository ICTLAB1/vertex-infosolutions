import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/checkout-form";
import { getCart, totalsFor } from "@/lib/cart";
import { formatMoney, STORE_CURRENCY } from "@/lib/money";
import { countryName } from "@/lib/shipping";
import { methodsFor } from "@/lib/types";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const cart = await getCart();
  if (!cart || cart.items.length === 0) redirect("/cart");

  const country = cart.country ?? null;
  const totals = totalsFor(cart.items, country);

  // A destination the store cannot serve is stopped at the cart, where there
  // is something the customer can do about it, rather than after they have
  // filled in an address.
  if (totals.shipping.known && "blocked" in totals.shipping) {
    redirect("/cart");
  }

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
          {cart.items.map((line) => (
            <li key={line.id} className="flex justify-between gap-4 py-2">
              <span className="min-w-0">
                <span className="block truncate text-ink">
                  {line.variant.product.name}
                </span>
                <span className="block text-[13px] text-muted">
                  {line.variant.name} · quantity {line.qty} ·{" "}
                  {line.variant.product.kind === "LICENCE"
                    ? "emailed"
                    : "shipped"}
                </span>
              </span>
              <span className="shrink-0 font-semibold text-ink">
                {formatMoney(line.variant.priceMinor * line.qty)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-muted">Items</dt>
            <dd>{formatMoney(totals.itemsMinor)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">
              Shipping
              {totals.shipping.known && !("blocked" in totals.shipping)
                ? ` to ${countryName(totals.shipping.country)}`
                : ""}
            </dt>
            <dd>
              {!totals.hasPhysical
                ? "None"
                : totals.shippingMinor === 0
                  ? "Free"
                  : formatMoney(totals.shippingMinor)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line-soft pt-2 text-[17px] font-bold text-ink">
            <dt>Total</dt>
            <dd>
              {formatMoney(totals.totalMinor)}{" "}
              <span className="text-[13px] font-normal text-faint">
                {STORE_CURRENCY}
              </span>
            </dd>
          </div>
          <p className="text-[12px] text-faint">
            This is the final amount we charge — nothing is added on the next
            screen.
            {totals.hasPhysical
              ? " Import duty and destination taxes are charged separately by your country when the parcel arrives."
              : ""}
          </p>
        </dl>
      </div>

      <CheckoutForm
        needsAddress={totals.hasPhysical}
        methods={methodsFor(totals.licencesOnly)}
        total={formatMoney(totals.totalMinor)}
        defaultCountry={country}
      />
    </div>
  );
}
