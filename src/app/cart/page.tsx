import type { Metadata } from "next";
import Link from "next/link";

import { removeFromCart, setQty } from "@/app/actions";
import { Glyph } from "@/components/glyph";
import { QtySelect } from "@/components/qty-select";
import { getCart, maxQtyFor, totalsFor, type CartLine } from "@/lib/cart";
import {
  estimateDelivery,
  formatDeliveryDate,
  FREE_SHIPPING_THRESHOLD_MINOR,
} from "@/lib/delivery";
import { formatMoney } from "@/lib/money";

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

  const totals = totalsFor(lines);
  const physical = lines.filter((l) => l.variant.product.kind === "PHYSICAL");
  const digital = lines.filter((l) => l.variant.product.kind === "LICENCE");
  const shortfall = FREE_SHIPPING_THRESHOLD_MINOR - totals.physicalMinor;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <h1 className="text-2xl font-bold text-ink">Shopping cart</h1>
          <p className="mt-1 border-b border-line-soft pb-3 text-[13px] text-muted">
            Prices include GST. Delivery is charged on shipped items only.
          </p>

          {/* The basket is shown in the two groups it will actually be
              fulfilled in, so the split is never a surprise at the end. */}
          {physical.length > 0 ? (
            <Group
              title="Shipped to you"
              note={
                totals.shippingMinor === 0
                  ? "Free delivery on this order"
                  : `${formatMoney(totals.shippingMinor)} delivery · free over ${formatMoney(FREE_SHIPPING_THRESHOLD_MINOR)}`
              }
              lines={physical}
            />
          ) : null}

          {digital.length > 0 ? (
            <Group
              title="Delivered by email"
              note="Keys are issued as soon as payment clears. No delivery charge."
              lines={digital}
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
            {physical.length > 0 && shortfall > 0 ? (
              <p className="mb-3 rounded-md border border-ok/30 bg-ok/5 p-2.5 text-[13px] text-ok">
                Add {formatMoney(shortfall)} of shipped items for free delivery.
              </p>
            ) : null}

            <dl className="space-y-1.5 text-[14px]">
              <Row label={`Items (${totals.count})`} value={formatMoney(totals.itemsMinor)} />
              <Row
                label="Delivery"
                value={
                  totals.shippingMinor === 0
                    ? "Free"
                    : formatMoney(totals.shippingMinor)
                }
              />
              <div className="flex justify-between border-t border-line-soft pt-2 text-[18px] font-bold text-ink">
                <dt>Order total</dt>
                <dd>{formatMoney(totals.totalMinor)}</dd>
              </div>
              <p className="text-[12px] text-faint">
                Includes {formatMoney(totals.taxMinor)} GST
              </p>
            </dl>

            <Link
              href="/checkout"
              className="btn-amber mt-4 block rounded-full py-2.5 text-center text-[15px] font-semibold"
            >
              Proceed to checkout
            </Link>
            <p className="mt-2 text-center text-[12px] text-faint">
              Card details are entered on the payment gateway&apos;s own page.
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
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function Group({
  title,
  note,
  lines,
}: {
  title: string;
  note: string;
  lines: CartLine[];
}) {
  return (
    <section className="mt-4">
      <h2 className="text-[15px] font-bold text-ink">{title}</h2>
      <p className="text-[13px] text-muted">{note}</p>
      <ul className="mt-2 divide-y divide-line-soft">
        {lines.map((line) => (
          <CartRow key={line.id} line={line} />
        ))}
      </ul>
    </section>
  );
}

function CartRow({ line }: { line: CartLine }) {
  const { variant } = line;
  const product = variant.product;
  const isLicence = product.kind === "LICENCE";
  const ceiling = maxQtyFor(variant.stockOnHand);
  const capped =
    variant.stockOnHand !== null && line.qty >= variant.stockOnHand;

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
        ) : (
          <p className="mt-1 text-[13px] text-muted">
            Arrives by{" "}
            <span className="font-semibold text-ink">
              {formatDeliveryDate(
                estimateDelivery(null, variant.leadDays ?? 3),
              )}
            </span>
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
