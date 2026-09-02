import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addToCart, buyNow } from "@/app/actions";
import { Glyph } from "@/components/glyph";
import { Stars } from "@/components/stars";
import { getProduct, ratingOf, specRows } from "@/lib/catalogue";
import { getCart, maxQtyFor } from "@/lib/cart";
import { discountPercent, formatMoney, STORE_CURRENCY } from "@/lib/money";
import {
  countryName,
  estimateArrival,
  formatArrival,
  zoneFor,
} from "@/lib/shipping";

export async function generateMetadata(
  props: PageProps<"/product/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product not found" };
  return { title: product.name, description: product.summary };
}

export default async function ProductPage(props: PageProps<"/product/[slug]">) {
  const { slug } = await props.params;
  const search = (await props.searchParams) as Record<
    string,
    string | string[] | undefined
  >;

  const [product, cart] = await Promise.all([getProduct(slug), getCart()]);
  if (!product) notFound();

  const country = cart?.country ?? null;
  const zone = country ? zoneFor(country) : null;

  const requestedSku = Array.isArray(search.sku) ? search.sku[0] : search.sku;
  const variant =
    product.variants.find((v) => v.sku === requestedSku) ?? product.variants[0];

  const isLicence = product.kind === "LICENCE";
  const { average, count } = ratingOf(product.reviews);
  const off = discountPercent(variant.listPriceMinor, variant.priceMinor);
  const ceiling = maxQtyFor(variant.stockOnHand);
  const available = isLicence || (variant.stockOnHand ?? 0) > 0;
  const specs = specRows(product.specs);
  const freeShipping =
    zone !== null && variant.priceMinor >= zone.freeOverMinor;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4">
      <nav className="mb-3 text-[13px] text-muted" aria-label="Breadcrumb">
        <Link href="/s" className="hover:text-link hover:underline">
          All
        </Link>
        <span className="px-1.5">›</span>
        <Link
          href={`/s?category=${product.category.slug}`}
          className="hover:text-link hover:underline"
        >
          {product.category.name}
        </Link>
        <span className="px-1.5">›</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,300px)]">
        {/* Image. Sits at its natural height rather than stretching to match
            the description column beside it. */}
        <div className="self-start rounded-lg border border-line bg-surface p-6">
          <div className="flex aspect-square items-center justify-center rounded bg-ground/60 text-nav-2">
            <Glyph name={product.glyph} className="h-48 w-48" />
          </div>
          <p className="mt-3 text-center text-[12px] text-faint">
            Product photography to follow — the drawing is a placeholder.
          </p>
        </div>

        {/* Detail */}
        <div className="min-w-0">
          <Link
            href={`/s?brand=${product.brand.slug}`}
            className="text-[13px] text-link hover:underline"
          >
            Visit the {product.brand.name} store
          </Link>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-ink">
            {product.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <Stars value={average} size={16} />
            <span className="text-ink">{average.toFixed(1)}</span>
            <a href="#reviews" className="text-link hover:underline">
              {count === 1 ? "1 review" : `${count} reviews`}
            </a>
          </div>

          <hr className="my-3 border-line-soft" />

          <div className="flex flex-wrap items-baseline gap-x-3">
            {off > 0 ? (
              <span className="text-2xl font-semibold text-deal">-{off}%</span>
            ) : null}
            <span className="text-3xl font-bold text-ink">
              {formatMoney(variant.priceMinor)}
            </span>
            <span className="text-[13px] text-faint">{STORE_CURRENCY}</span>
          </div>
          {off > 0 ? (
            <p className="mt-0.5 text-[13px] text-muted">
              List price{" "}
              <span className="line-through">
                {formatMoney(variant.listPriceMinor)}
              </span>
            </p>
          ) : null}
          <p className="mt-1 text-[13px] text-muted">
            {isLicence ? (
              <>
                Electronic delivery. No shipping, no customs, no duty.
              </>
            ) : (
              <>
                Excludes shipping and any import duty or tax the destination
                charges on arrival.{" "}
                <Link href="/shipping" className="text-link underline">
                  How this works
                </Link>
              </>
            )}
          </p>

          {product.variants.length > 1 ? (
            <div className="mt-4">
              <h2 className="mb-2 text-[13px] font-bold text-ink">
                Choose an option
              </h2>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((option) => {
                  const chosen = option.sku === variant.sku;
                  const soldOut = !isLicence && (option.stockOnHand ?? 0) <= 0;
                  return (
                    <Link
                      key={option.sku}
                      href={`/product/${product.slug}?sku=${option.sku}`}
                      scroll={false}
                      aria-current={chosen ? "true" : undefined}
                      className={`rounded-md border px-3 py-2 text-[13px] ${
                        chosen
                          ? "border-brand bg-brand/5 ring-1 ring-brand"
                          : "border-line hover:border-faint"
                      } ${soldOut ? "opacity-55" : ""}`}
                    >
                      <span className="block font-semibold text-ink">
                        {option.name}
                      </span>
                      <span className="block text-muted">
                        {formatMoney(option.priceMinor)}
                        {soldOut ? " · out of stock" : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {product.bullets.length > 0 ? (
            <section className="mt-5">
              <h2 className="mb-2 text-[15px] font-bold text-ink">
                About this item
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[14px] text-muted marker:text-faint">
                {product.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-5">
            <h2 className="mb-2 text-[15px] font-bold text-ink">
              Technical details
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <tbody>
                  {specs.map(([name, value]) => (
                    <tr key={name} className="border-b border-line-soft">
                      <th
                        scope="row"
                        className="w-2/5 bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                      >
                        {name}
                      </th>
                      <td className="px-3 py-2 text-muted">{value}</td>
                    </tr>
                  ))}
                  {/* Customs data. Printed on the commercial invoice that
                      travels with the parcel, and shown here because a buyer
                      importing goods often has to declare it themselves. */}
                  {product.origin ? (
                    <tr className="border-b border-line-soft">
                      <th
                        scope="row"
                        className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                      >
                        Country of origin
                      </th>
                      <td className="px-3 py-2 text-muted">{product.origin}</td>
                    </tr>
                  ) : null}
                  {product.hsCode ? (
                    <tr className="border-b border-line-soft">
                      <th
                        scope="row"
                        className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                      >
                        HS code
                      </th>
                      <td className="px-3 py-2 font-mono text-[12px] text-muted">
                        {product.hsCode}
                      </td>
                    </tr>
                  ) : null}
                  {variant.weightGrams ? (
                    <tr className="border-b border-line-soft">
                      <th
                        scope="row"
                        className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                      >
                        Shipping weight
                      </th>
                      <td className="px-3 py-2 text-muted">
                        {(variant.weightGrams / 1000).toFixed(2)} kg
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <th
                      scope="row"
                      className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                    >
                      SKU
                    </th>
                    <td className="px-3 py-2 font-mono text-[12px] text-muted">
                      {variant.sku}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Buy box */}
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-2xl font-bold text-ink">
              {formatMoney(variant.priceMinor)}
            </p>

            {isLicence ? (
              <p className="mt-2 text-[13px] text-muted">
                <span className="font-semibold text-ok">Delivered by email</span>{" "}
                — the key is issued to your inbox as soon as payment clears,
                anywhere in the world.
              </p>
            ) : zone ? (
              <p className="mt-2 text-[13px] text-muted">
                {freeShipping ? (
                  <span className="font-semibold text-ok">FREE shipping</span>
                ) : (
                  <>${zone.shippingMinor / 100} shipping</>
                )}{" "}
                to {countryName(country!)} · arrives{" "}
                <span className="font-semibold text-ink">
                  {formatArrival(
                    estimateArrival(country, variant.leadDays ?? 3),
                  )}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-muted">
                Ships worldwide. Choose your country in the header for a
                delivery date and shipping cost.
              </p>
            )}

            <p className="mt-3 text-[17px] font-semibold">
              {available ? (
                <span className="text-ok">In stock</span>
              ) : (
                <span className="text-deal">Currently unavailable</span>
              )}
            </p>
            {!isLicence &&
            variant.stockOnHand !== null &&
            variant.stockOnHand > 0 &&
            variant.stockOnHand <= 5 ? (
              <p className="text-[13px] text-deal">
                Only {variant.stockOnHand} left — order soon.
              </p>
            ) : null}

            {available ? (
              <div className="mt-4 space-y-2">
                <form action={addToCart} className="space-y-2">
                  <input type="hidden" name="variantId" value={variant.id} />
                  <label
                    htmlFor="qty"
                    className="block text-[13px] font-semibold text-ink"
                  >
                    Quantity
                  </label>
                  <select
                    id="qty"
                    name="qty"
                    defaultValue="1"
                    className="w-full rounded-md border border-line bg-ground/50 px-3 py-2 text-[14px]"
                  >
                    {Array.from({ length: ceiling }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="btn-amber w-full rounded-full py-2.5 text-[15px] font-semibold"
                  >
                    Add to cart
                  </button>
                </form>

                <form action={buyNow}>
                  <input type="hidden" name="variantId" value={variant.id} />
                  <input type="hidden" name="qty" value="1" />
                  <button
                    type="submit"
                    className="btn-orange w-full rounded-full py-2.5 text-[15px] font-semibold"
                  >
                    Buy now
                  </button>
                </form>
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-line bg-ground/50 p-3 text-[13px] text-muted">
                We can source this to order. Email us and we will confirm a date
                and a freight cost before you pay.
              </p>
            )}

            <dl className="mt-4 space-y-1.5 border-t border-line-soft pt-3 text-[13px]">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Sold by</dt>
                <dd className="text-ink">Vertex Infosolutions</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Payment</dt>
                <dd className="text-ink">
                  Card or PayPal, on the provider&apos;s own page
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Returns</dt>
                <dd className="text-ink">
                  {isLicence
                    ? "Not returnable once the key is revealed"
                    : "14 days, unopened and undamaged"}
                </dd>
              </div>
              {!isLicence ? (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-faint">Duties</dt>
                  <dd className="text-ink">
                    Payable by the recipient on arrival
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>

      <Reviews reviews={product.reviews} average={average} count={count} />
    </div>
  );
}

function Reviews({
  reviews,
  average,
  count,
}: {
  reviews: {
    id: string;
    author: string;
    country: string | null;
    rating: number;
    title: string;
    body: string;
    verified: boolean;
    createdAt: Date;
  }[];
  average: number;
  count: number;
}) {
  // The distribution matters more than the average. A 4.2 made of fives and
  // ones is a different product from a 4.2 made entirely of fours, and hiding
  // that is the sort of thing shoppers notice.
  const histogram = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    n: reviews.filter((review) => review.rating === stars).length,
  }));

  return (
    <section
      id="reviews"
      className="mt-6 rounded-lg border border-line bg-surface p-5"
    >
      <h2 className="text-xl font-bold text-ink">Customer reviews</h2>

      {count === 0 ? (
        <p className="mt-2 text-muted">
          No reviews yet. Reviews can only be left by someone whose order for
          this item was delivered.
        </p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[260px_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Stars value={average} size={18} />
              <span className="text-[15px] font-semibold text-ink">
                {average.toFixed(1)} out of 5
              </span>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {count === 1 ? "1 review" : `${count} reviews`}
            </p>

            <ul className="mt-3 space-y-1.5">
              {histogram.map((row) => {
                const percent = count > 0 ? (row.n / count) * 100 : 0;
                return (
                  <li
                    key={row.stars}
                    className="flex items-center gap-2 text-[13px]"
                  >
                    <span className="w-12 shrink-0 text-link">
                      {row.stars} star
                    </span>
                    <span className="h-4 flex-1 overflow-hidden rounded-sm bg-ground">
                      <span
                        className="block h-full bg-star"
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right tabular-nums text-muted">
                      {Math.round(percent)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="space-y-5">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="border-b border-line-soft pb-4 last:border-0"
              >
                <p className="text-[14px] font-semibold text-ink">
                  {review.author}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Stars value={review.rating} />
                  <span className="text-[14px] font-semibold text-ink">
                    {review.title}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap gap-x-3 text-[12px]">
                  {review.country ? (
                    <span className="text-faint">
                      Reviewed in {review.country}
                    </span>
                  ) : null}
                  {review.verified ? (
                    <span className="font-semibold text-ok">
                      Verified purchase
                    </span>
                  ) : null}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                  {review.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
