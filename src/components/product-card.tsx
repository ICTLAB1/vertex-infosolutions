import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { Stars } from "@/components/stars";
import {
  priceOf,
  ratingOf,
  sellableVariants,
  TERM_LABELS,
  type ListedProduct,
} from "@/lib/catalogue";
import { deliveryShort } from "@/lib/delivery";
import type { CurrencyCode } from "@/lib/market";
import { discountPercent, formatMoney } from "@/lib/money";

export function ProductCard({
  product,
  currency,
  domestic,
}: {
  product: ListedProduct;
  currency: CurrencyCode;
  /** True in the Indian market, where displayed prices include GST. */
  domestic: boolean;
}) {
  const sellable = sellableVariants(product.variants);
  // A quote-only product has no price row anywhere and is still on sale; a
  // priced one with nothing in this currency is not sold in this market.
  if (sellable.length === 0 && !product.quoteOnly) return null;

  const cheapest =
    sellable.length > 0
      ? sellable.reduce((low, variant) =>
          priceOf(variant)!.priceMinor < priceOf(low)!.priceMinor ? variant : low,
        )
      : null;
  const price = cheapest ? priceOf(cheapest)! : null;
  const { average, count } = ratingOf(product.reviews);
  const off = price ? discountPercent(price.listMinor, price.priceMinor) : 0;
  const perSeat =
    price && cheapest ? Math.round(price.priceMinor / cheapest.seats) : 0;
  // The cheapest variant's number when there is one, otherwise the first — a
  // card shows one listing, so it shows one number.
  const partNumber = (cheapest ?? product.variants[0])?.partNumber ?? null;

  return (
    <article className="group flex h-full flex-col rounded-lg border border-line bg-surface p-3 transition-shadow hover:shadow-md">
      <Link
        href={`/product/${product.slug}`}
        className="flex h-32 items-center justify-center rounded bg-ground/60 text-nav-2"
      >
        <ProductImage
          logo={product.logo}
          glyph={product.glyph}
          name={product.name}
          className="h-20 w-20"
          sizes="80px"
        />
      </Link>

      <div className="mt-3 flex flex-1 flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          {product.brand.name}
        </p>
        <h3 className="mt-0.5 text-[14px] leading-snug">
          <Link
            href={`/product/${product.slug}`}
            className="line-clamp-2 text-ink hover:text-link hover:underline"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-1.5 flex min-h-[18px] items-center gap-1.5">
          {count > 0 ? (
            <>
              <Stars value={average} />
              <span className="text-[12px] text-link">{count}</span>
            </>
          ) : (
            // Not "No reviews yet", which advertises the absence. Something
            // true about the listing instead.
            <span className="text-[12px] text-muted">
              Authorised reseller · genuine licence
            </span>
          )}
        </div>

        {price ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
              {off > 0 ? (
                <span className="text-[13px] font-semibold text-deal">
                  -{off}%
                </span>
              ) : null}
              <span className="text-[19px] font-bold text-ink">
                {formatMoney(price.priceMinor, currency)}
              </span>
              {off > 0 ? (
                <span className="text-[12px] text-faint line-through">
                  {formatMoney(price.listMinor, currency)}
                </span>
              ) : null}
            </div>

            {/* Per-seat is how these products are actually compared, and a
                multi-seat SKU's headline number hides it. */}
            {cheapest && cheapest.seats > 1 ? (
              <p className="text-[12px] text-muted">
                {formatMoney(perSeat, currency)} per seat
              </p>
            ) : null}
          </>
        ) : (
          // Not a blank, and not a zero. The shop sells this and has to be
          // asked what it costs, which is a sentence, not a missing number.
          <p className="mt-2 text-[19px] font-bold text-ink">
            Price on request
          </p>
        )}

        <p className="mt-0.5 text-[12px] text-muted">
          {TERM_LABELS[product.term]}
          {price && domestic ? " · incl. GST" : ""}
        </p>

        {/* The publisher's own number, on the card as well as the page: a buyer
            comparing two shops is matching part numbers, and making them open
            the listing to find it is making them leave. */}
        {partNumber ? (
          <p className="mt-0.5 truncate font-mono text-[11px] text-faint">
            {partNumber}
          </p>
        ) : null}

        {sellable.length > 1 ? (
          <p className="mt-0.5 text-[12px] text-muted">
            {sellable.length} seat options
          </p>
        ) : null}

        <div className="mt-auto pt-2 text-[12px]">
          <p className="font-semibold text-ok">
            {product.quoteOnly
              ? "Quoted within one business day"
              : deliveryShort(product.cspNewTenant)}
          </p>
        </div>
      </div>
    </article>
  );
}
