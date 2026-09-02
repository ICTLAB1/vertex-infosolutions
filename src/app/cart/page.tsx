import type { Metadata } from "next";
import Link from "next/link";

import { removeFromCart, setDestination, setQty } from "@/app/actions";
import { CountrySelect } from "@/components/country-select";
import { Glyph } from "@/components/glyph";
import { QtySelect } from "@/components/qty-select";
import {
  getCart,
  maxQtyFor,
  totalsFor,
  type CartLine,
  type CartTotals,
} from "@/lib/cart";
import { formatMoney, STORE_CURRENCY } from "@/lib/money";
import {
  countryName,
  estimateArrival,
  formatArrival,
  zoneFor,
} from "@/lib/shipping";

export const metadata: Metadata = { title: "Your cart" };

export default async function CartPage() {
  const cart = await getCart();
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
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const country = cart?.country ?? null;
  const totals = totalsFor(lines, country);
  const physical = lines.filter((l) => l.variant.product.kind === "PHYSICAL");
  const digital = lines.filter((l) => l.variant.product.kind === "LICENCE");
  const zone = country ? zoneFor(country) : null;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <h1 className="text-2xl font-bold text-ink">Shopping cart</h1>
          <p className="mt-1 border-b border-line-soft pb-3 text-[13px] text-muted">
            All prices in {STORE_CURRENCY}. Shipping is charged on shipped items
            only, and import duty is charged by your country on arrival.
          </p>

          {/* The basket is shown in the two groups it will actually be
              fulfilled in, so the split is never a surprise at the end. */}
          {physical.length > 0 ? (
            <Group
              title="Shipped to you"
              note={shippingNote(totals)}
              lines={physical}
              country={country}
            />
          ) : null}

          {digital.length > 0 ? (
            <Group
              title="Delivered by email"
              note="Keys are issued as soon as payment clears. No shipment, no customs, no duty."
              lines={digital}
              country={country}
            />
          ) : null}

          <p className="mt-4 border-t border-line-soft pt-3 text-right text-[15px]">
            Subtotal ({totals.count} {totals.count === 1 ? "item" : "items"}):{" "}
            <span className="text-xl font-bold text-ink">
              {formatMoney(totals.itemsMinor)}
            </span>
          </p>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-4">
            {/* Carriage cannot be quoted without a destination, so the cart
                asks for one here rather than showing a total that changes at
                the payment step. */}
            {totals.hasPhysical ? (
              <form
                action={setDestination}
                className="mb-3 border-b border-line-soft pb-3"
              >
                <p className="mb-1.5 text-[13px] font-semibold text-ink">
                  Shipping to
                </p>
                <CountrySelect
                  id="cart-country"
                  label="Destination country"
                  value={country}
                  className="w-full rounded-md border border-line bg-ground/50 px-2 py-1.5 text-[14px]"
                />
                {zone ? (
                  <p className="mt-1.5 text-[12px] text-muted">
                    {zone.label} · {zone.transitDays[0]}–{zone.transitDays[1]}{" "}
                    business days after dispatch
                  </p>
                ) : null}
              </form>
            ) : null}

            {totals.hasPhysical &&
            totals.shipping.known &&
            "free" in totals.shipping &&
            !totals.shipping.free &&
            zone ? (
              <p className="mb-3 rounded-md border border-ok/30 bg-ok/5 p-2.5 text-[13px] text-ok">
                Add{" "}
                {formatMoney(zone.freeOverMinor - totals.physicalMinor)} of
                shipped items for free shipping to{" "}
                {countryName(totals.shipping.country)}.
              </p>
            ) : null}

            <dl className="space-y-1.5 text-[14px]">
              <Row
                label={`Items (${totals.count})`}
                value={formatMoney(totals.itemsMinor)}
              />
              <Row label="Shipping" value={shippingValue(totals)} />
              <Row label="Import duty & taxes" value="Payable on arrival" />
              <div className="flex justify-between border-t border-line-soft pt-2 text-[18px] font-bold text-ink">
                <dt>Order total</dt>
                <dd>{formatMoney(totals.totalMinor)}</dd>
              </div>
            </dl>

            {blockedMessage(totals) ? (
              <p
                role="alert"
                className="mt-3 rounded-md border border-deal/40 bg-deal/5 p-2.5 text-[13px] text-deal"
              >
                {blockedMessage(totals)}
              </p>
            ) : (
              <Link
                href="/checkout"
                className="btn-amber mt-4 block rounded-full py-2.5 text-center text-[15px] font-semibold"
              >
                Proceed to checkout
              </Link>
            )}

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

function shippingNote(totals: CartTotals): string {
  if (!totals.shipping.known) {
    return "Choose a destination on the right for a shipping cost and a delivery date.";
  }
  if ("blocked" in totals.shipping) {
    return totals.shipping.blocked === "restricted"
      ? "We cannot ship to this destination."
      : "We do not ship to this destination yet.";
  }
  return totals.shipping.free
    ? `Free shipping to ${countryName(totals.shipping.country)}`
    : `${formatMoney(totals.shippingMinor)} shipping to ${countryName(totals.shipping.country)}`;
}

function shippingValue(totals: CartTotals): string {
  if (!totals.hasPhysical) return "None — nothing to ship";
  if (!totals.shipping.known) return "Choose a country";
  if ("blocked" in totals.shipping) return "Unavailable";
  return totals.shipping.free ? "Free" : formatMoney(totals.shippingMinor);
}

function blockedMessage(totals: CartTotals): string | null {
  if (!totals.shipping.known || !("blocked" in totals.shipping)) return null;
  const where = countryName(totals.shipping.country);
  return totals.shipping.blocked === "restricted"
    ? `We cannot ship to ${where}. See our export compliance policy.`
    : `We do not ship to ${where} yet. Email us and we will quote a freight forwarder.`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function Group({
  title,
  note,
  lines,
  country,
}: {
  title: string;
  note: string;
  lines: CartLine[];
  country: string | null;
}) {
  return (
    <section className="mt-4">
      <h2 className="text-[15px] font-bold text-ink">{title}</h2>
      <p className="text-[13px] text-muted">{note}</p>
      <ul className="mt-2 divide-y divide-line-soft">
        {lines.map((line) => (
          <CartRow key={line.id} line={line} country={country} />
        ))}
      </ul>
    </section>
  );
}

function CartRow({
  line,
  country,
}: {
  line: CartLine;
  country: string | null;
}) {
  const { variant } = line;
  const product = variant.product;
  const isLicence = product.kind === "LICENCE";
  const ceiling = maxQtyFor(variant.stockOnHand);
  const capped = variant.stockOnHand !== null && line.qty >= variant.stockOnHand;

  return (
    <li className="flex gap-4 py-4">
      <Link
        href={`/product/${product.slug}`}
        className="flex h-24 w-24 shrink-0 items-center justify-center rounded bg-ground/60 text-nav-2"
      >
        <Glyph name={product.glyph} className="h-16 w-16" />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/product/${product.slug}?sku=${variant.sku}`}
          className="text-[15px] font-semibold text-ink hover:text-link hover:underline"
        >
          {product.name}
        </Link>
        <p className="text-[13px] text-muted">{variant.name}</p>
        <p className="mt-0.5 font-mono text-[12px] text-faint">{variant.sku}</p>

        {isLicence ? (
          <p className="mt-1 text-[13px] text-ok">
            Key emailed on payment · not returnable once revealed
          </p>
        ) : country ? (
          <p className="mt-1 text-[13px] text-muted">
            Arrives{" "}
            <span className="font-semibold text-ink">
              {formatArrival(estimateArrival(country, variant.leadDays ?? 3))}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-muted">
            Delivery date depends on the destination
          </p>
        )}

        {capped ? (
          <p className="mt-1 text-[13px] text-warn">
            Only {variant.stockOnHand} in stock — quantity capped.
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <form action={setQty} className="flex items-center gap-2">
            <input type="hidden" name="itemId" value={line.id} />
            <QtySelect
              id={`qty-${line.id}`}
              name="qty"
              defaultValue={line.qty}
              max={Math.max(ceiling, line.qty)}
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
        <p className="text-[16px] font-bold text-ink">
          {formatMoney(variant.priceMinor * line.qty)}
        </p>
        {line.qty > 1 ? (
          <p className="text-[12px] text-faint">
            {formatMoney(variant.priceMinor)} each
          </p>
        ) : null}
      </div>
    </li>
  );
}
