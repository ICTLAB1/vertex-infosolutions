import Link from "next/link";

import { Glyph } from "@/components/glyph";
import { Stars } from "@/components/stars";
import { ratingOf, type ListedProduct } from "@/lib/catalogue";
import {
  estimateDelivery,
  formatDeliveryDate,
  FREE_SHIPPING_THRESHOLD_MINOR,
} from "@/lib/delivery";
import { discountPercent, formatMoney } from "@/lib/money";

export function ProductCard({ product }: { product: ListedProduct }) {
  const cheapest = product.variants.reduce((low, variant) =>
    variant.priceMinor < low.priceMinor ? variant : low,
  );
  const { average, count } = ratingOf(product.reviews);
  const off = discountPercent(cheapest.mrpMinor, cheapest.priceMinor);
  const isLicence = product.kind === "LICENCE";
  const inStock =
    isLicence || product.variants.some((v) => (v.stockOnHand ?? 0) > 0);

  return (
    <article className="group flex h-full flex-col rounded-lg border border-line bg-surface p-3 transition-shadow hover:shadow-md">
      <Link
        href={`/product/${product.slug}`}
        className="flex h-36 items-center justify-center rounded bg-ground/60 text-nav-2"
      >
        <Glyph name={product.glyph} className="h-24 w-24" />
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
            <span className="text-[12px] text-faint">No reviews yet</span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          {off > 0 ? (
            <span className="text-[13px] font-semibold text-deal">
              -{off}%
            </span>
          ) : null}
          <span className="text-[19px] font-bold text-ink">
            {formatMoney(cheapest.priceMinor)}
          </span>
          {off > 0 ? (
            <span className="text-[12px] text-faint line-through">
              {formatMoney(cheapest.mrpMinor)}
            </span>
          ) : null}
        </div>

        {product.variants.length > 1 ? (
          <p className="mt-0.5 text-[12px] text-muted">
            {product.variants.length} options
          </p>
        ) : null}

        <div className="mt-auto pt-2 text-[12px]">
          {isLicence ? (
            <p className="text-ok">
              <span className="font-semibold">Delivered by email</span> — key
              issued on payment
            </p>
          ) : inStock ? (
            <p className="text-muted">
              {cheapest.priceMinor >= FREE_SHIPPING_THRESHOLD_MINOR
                ? "Free delivery by "
                : "Delivery by "}
              <span className="font-semibold text-ink">
                {formatDeliveryDate(
                  estimateDelivery(null, cheapest.leadDays ?? 3),
                )}
              </span>
            </p>
          ) : (
            <p className="font-semibold text-deal">Currently out of stock</p>
          )}
        </div>
      </div>
    </article>
  );
}
