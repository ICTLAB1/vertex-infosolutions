import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addToCart, buyNow } from "@/app/actions";
import { ProductImage } from "@/components/product-image";
import { Assurance } from "@/components/assurance";
import { BulkQuoteLine } from "@/components/bulk-quote";
import { TenantNotice } from "@/components/tenant-notice";
import { QuoteOnlyProduct } from "./quote-only";
import { deliveryHeadline, deliverySummary } from "@/lib/delivery";
import {
  absolute,
  jsonLd,
  priceValidUntil,
  productImages,
} from "@/lib/seo";
import { Stars } from "@/components/stars";
import { getMarket, MAX_QTY } from "@/lib/cart";
import {
  getProduct,
  priceOf,
  ratingOf,
  partNumberLabel,
  sellableVariants,
  specRows,
  TERM_LABELS,
  TERM_NOTES,
} from "@/lib/catalogue";
import { discountPercent, formatMoney, splitInclusiveTax } from "@/lib/money";

export async function generateMetadata(
  props: PageProps<"/product/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const market = await getMarket();
  const product = await getProduct(slug, market.currency);
  if (!product) return { title: "Product not found" };

  const images = productImages(product);
  const price = product.variants.find((v) => v.prices.length > 0)?.prices[0];
  const priced = price
    ? ` ${formatMoney(price.priceMinor, market.currency)}${market.domestic ? " incl. GST" : ""}.`
    : product.quoteOnly
      ? " Priced on request — quoted within one business day."
      : "";

  return {
    title: product.name,
    description: `${product.summary}${priced} Genuine licence from an authorised reseller.`,
    // One canonical per product, without the ?sku= that variant links add —
    // otherwise every variant is a duplicate of the same page competing with
    // it. The path carries no currency either: the same product at two prices
    // is one product.
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description: product.summary,
      url: `/product/${slug}`,
      // The same picture the structured data names, so a listing shared into
      // WhatsApp and a listing in Google Shopping show one thing rather than
      // two. It was the shop's wordmark on every product before this, which
      // made four hundred different links look like the same link.
      images: [{ url: images.social, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: product.summary,
      images: [images.social],
    },
  };
}

export default async function ProductPage(props: PageProps<"/product/[slug]">) {
  const { slug } = await props.params;
  const search = (await props.searchParams) as Record<
    string,
    string | string[] | undefined
  >;

  const market = await getMarket();
  const currency = market.currency;
  const product = await getProduct(slug, currency);
  if (!product) notFound();

  const sellable = sellableVariants(product.variants);

  // Sold, but not at a published price. A page of its own rather than a
  // conditional through the priced one: nearly every line below is about a
  // figure, and threading "if there is a price" through all of them is how a
  // blank or a zero eventually reaches a customer.
  if (product.quoteOnly) {
    return <QuoteOnlyProduct product={product} domestic={market.domestic} />;
  }

  // A product with no price in this market genuinely is not sold here. Saying
  // so beats rendering a page with a blank where the price should be.
  if (sellable.length === 0) {
    return (
      <div className="mx-auto max-w-[700px] px-4 py-12">
        <div className="rounded-lg border border-line bg-surface p-8 text-center">
          <h1 className="text-xl font-bold text-ink">{product.name}</h1>
          <p className="mt-2 text-muted">
            This licence is not sold in {currency} yet. Switch the market in the
            header, or email us and we will quote it.
          </p>
        </div>
      </div>
    );
  }

  const requestedSku = Array.isArray(search.sku) ? search.sku[0] : search.sku;
  const variant =
    sellable.find((v) => v.sku === requestedSku) ?? sellable[0];
  const price = priceOf(variant)!;

  const { average, count } = ratingOf(product.reviews);
  const images = productImages(product);
  const off = discountPercent(price.listMinor, price.priceMinor);
  const perSeat = Math.round(price.priceMinor / variant.seats);
  const specs = specRows(product.specs);
  const gst = market.domestic
    ? splitInclusiveTax(price.priceMinor, product.gstRatePercent)
    : null;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4">
      <nav className="mb-3 text-[13px] text-muted" aria-label="Breadcrumb">
        <Link href="/s" className="hover:text-link hover:underline">
          All
        </Link>
        <span className="px-1.5">›</span>
        <Link
          href={`/s?brand=${product.brand.slug}`}
          className="hover:text-link hover:underline"
        >
          {product.brand.name}
        </Link>
        <span className="px-1.5">›</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      {/* What this page is, for a search engine: a product, its publisher,
          its SKU, and the one price actually on offer in this market. The
          price has to be the displayed one — structured data that disagrees
          with the page is worse than none, and Google checks. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                // Mirrors the breadcrumb the page already shows, so a search
                // result carries "All > Microsoft > Business Premium" rather
                // than a bare URL.
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "All licences",
                    item: absolute("/s"),
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: product.brand.name,
                    item: absolute(`/s?brand=${product.brand.slug}`),
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: product.name,
                    item: absolute(`/product/${product.slug}`),
                  },
                ],
              },
              {
            "@type": "Product",
            name: product.name,
            description: product.summary,
            // The publisher's number where we have it: it is what a shopping
            // engine matches this listing against other sellers' listings of
            // the same item, which our own prefixed SKU cannot do.
            sku: variant.partNumber ?? variant.sku,
            ...(variant.partNumber ? { mpn: variant.partNumber } : {}),
            brand: { "@type": "Brand", name: product.brand.name },
            category: product.category.name,
            // Never conditional. A Product with no image is dropped from
            // shopping results outright, so `productImages` always returns
            // something — the listing's own picture where one exists, its
            // publisher's card otherwise.
            image: images.all,
            offers: {
              "@type": "Offer",
              url: absolute(`/product/${product.slug}`),
              // The currency this page is actually showing. Structured data
              // that disagrees with the visible price is worse than none, and
              // Google checks — so this follows the market rather than being
              // pinned to one side of it.
              priceCurrency: currency,
              price: (price.priceMinor / 100).toFixed(2),
              priceValidUntil: priceValidUntil(),
              availability: "https://schema.org/InStock",
              itemCondition: "https://schema.org/NewCondition",
              seller: { "@type": "Organization", name: "Vertex Infosolutions" },
            },
            // Ratings only where there are ratings. An aggregateRating of 0
            // out of 0, or a placeholder five stars, is a manual penalty
            // waiting to happen — and it would be a lie told to a customer
            // before it was ever a lie told to Google. With no reviews both
            // fields are simply absent.
            ...(count > 0
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: average.toFixed(1),
                    reviewCount: count,
                  },
                  review: product.reviews.slice(0, 5).map((entry) => ({
                    "@type": "Review",
                    author: { "@type": "Person", name: entry.author },
                    datePublished: entry.createdAt.toISOString().slice(0, 10),
                    reviewRating: {
                      "@type": "Rating",
                      ratingValue: entry.rating,
                      bestRating: 5,
                      worstRating: 1,
                    },
                    name: entry.title,
                    reviewBody: entry.body,
                  })),
                }
              : {}),
              },
            ],
          }),
        }}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,310px)]">
        <div className="self-start rounded-lg border border-line bg-surface p-6">
          <div className="flex aspect-square items-center justify-center rounded bg-ground/60 text-nav-2">
            <ProductImage
              logo={product.logo}
              glyph={product.glyph}
              name={product.name}
              className="h-40 w-40"
              sizes="160px"
            />
          </div>
          <p className="mt-3 text-center text-[12px] text-faint">
            Supplied under {product.brand.name}&apos;s own end-user terms.
            Vertex is the reseller.
          </p>
        </div>

        <div className="min-w-0">
          <Link
            href={`/s?brand=${product.brand.slug}`}
            className="text-[13px] text-link hover:underline"
          >
            All {product.brand.name} licences
          </Link>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-ink">
            {product.name}
          </h1>
          <p className="mt-1 text-[14px] text-muted">{product.summary}</p>

          {/* Five grey stars over "0.0" says "nobody bought this" more loudly
              than saying nothing. With no reviews the row is simply absent and
              the assurance panel below carries the weight instead. */}
          {count > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
              <Stars value={average} size={16} />
              <span className="text-ink">{average.toFixed(1)}</span>
              <a href="#reviews" className="text-link hover:underline">
                {count === 1 ? "1 review" : `${count} reviews`}
              </a>
            </div>
          ) : null}

          <hr className="my-3 border-line-soft" />

          <div className="flex flex-wrap items-baseline gap-x-3">
            {off > 0 ? (
              <span className="text-2xl font-semibold text-deal">-{off}%</span>
            ) : null}
            <span className="text-3xl font-bold text-ink">
              {formatMoney(price.priceMinor, currency)}
            </span>
            <span className="text-[13px] text-faint">{currency}</span>
          </div>
          {off > 0 ? (
            <p className="mt-0.5 text-[13px] text-muted">
              List price{" "}
              <span className="line-through">
                {formatMoney(price.listMinor, currency)}
              </span>
            </p>
          ) : null}

          {/* The tax line is the whole difference between the two markets, so
              it is stated on the page rather than discovered at checkout. */}
          {gst ? (
            <p className="mt-1 text-[13px] text-muted">
              Inclusive of {product.gstRatePercent}% GST (
              {formatMoney(gst.taxMinor, currency)})
              {product.sacCode ? (
                <>
                  {" · "}
                  <span className="font-mono text-[12px]">
                    SAC {product.sacCode}
                  </span>
                </>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted">
              No Indian tax is added — this is a zero-rated export. Any tax your
              own country charges on imported software is not included.
            </p>
          )}

          <p className="mt-3 inline-flex rounded-md border border-line bg-ground/60 px-3 py-1.5 text-[13px]">
            <span className="font-semibold text-ink">
              {TERM_LABELS[product.term]}
            </span>
            <span className="px-1.5 text-faint">·</span>
            <span className="text-muted">{TERM_NOTES[product.term]}</span>
          </p>

          <Assurance
            brand={product.brand.name}
            domestic={market.domestic}
            sku={variant.sku.startsWith("MS-") ? variant.sku.slice(3) : null}
          />

          {sellable.length > 1 ? (
            <div className="mt-4">
              <h2 className="mb-2 text-[13px] font-bold text-ink">
                Choose your seats
              </h2>
              <div className="flex flex-wrap gap-2">
                {sellable.map((option) => {
                  const chosen = option.sku === variant.sku;
                  const optionPrice = priceOf(option)!;
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
                      }`}
                    >
                      <span className="block font-semibold text-ink">
                        {option.name}
                      </span>
                      <span className="block text-muted">
                        {formatMoney(optionPrice.priceMinor, currency)}
                        {option.seats > 1
                          ? ` · ${formatMoney(Math.round(optionPrice.priceMinor / option.seats), currency)}/seat`
                          : ""}
                      </span>
                      {/* Each seat option is a different item with a different
                          number, so the number moves with the choice. */}
                      {option.partNumber ? (
                        <span className="block font-mono text-[11px] text-faint">
                          {option.partNumber}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {product.bullets.length > 0 ? (
            <section className="mt-5">
              <h2 className="mb-2 text-[15px] font-bold text-ink">
                What you get
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
              Licence details
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
                  <tr className="border-b border-line-soft">
                    <th
                      scope="row"
                      className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                    >
                      Seats in this SKU
                    </th>
                    <td className="px-3 py-2 text-muted">
                      {variant.seats}
                      {variant.seats > 1
                        ? ` · ${formatMoney(perSeat, currency)} per seat`
                        : ""}
                    </td>
                  </tr>
                  <tr className="border-b border-line-soft">
                    <th
                      scope="row"
                      className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                    >
                      Publisher
                    </th>
                    <td className="px-3 py-2 text-muted">
                      {product.brand.name} — Vertex is an authorised reseller
                    </td>
                  </tr>
                  {variant.partNumber ? (
                    <tr className="border-b border-line-soft">
                      <th
                        scope="row"
                        className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                      >
                        {partNumberLabel(product.brand.slug)}
                      </th>
                      <td className="px-3 py-2 font-mono text-[12px] text-ink">
                        {variant.partNumber}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <th
                      scope="row"
                      className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                    >
                      Our SKU
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
              {formatMoney(price.priceMinor, currency)}
            </p>
            <p className="text-[13px] text-muted">
              {variant.name}
              {market.domestic ? " · incl. GST" : ""}
            </p>
            {variant.partNumber ? (
              <p className="mt-0.5 font-mono text-[12px] text-faint">
                {variant.partNumber}
              </p>
            ) : null}

            <p className="mt-2 text-[13px] text-muted">
              <span className="font-semibold text-ok">
                {deliveryHeadline(product.cspNewTenant)}
              </span>{" "}
              — {deliverySummary(product.cspNewTenant)}
            </p>

            {product.cspNewTenant && <TenantNotice />}

            <div className="mt-4 space-y-2">
              <form action={addToCart} className="space-y-2">
                <input type="hidden" name="variantId" value={variant.id} />
                <label
                  htmlFor="qty"
                  className="block text-[13px] font-semibold text-ink"
                >
                  Quantity
                </label>
                <input
                  id="qty"
                  name="qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_QTY}
                  step={1}
                  defaultValue="1"
                  className="w-full rounded-md border border-line bg-ground/50 px-3 py-2 text-[14px] tabular-nums"
                />
                {variant.seats > 1 && (
                  <p className="text-[12px] text-muted">
                    Each licence covers {variant.seats} seats.
                  </p>
                )}
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

            <BulkQuoteLine className="mt-3" productSlug={product.slug} />

            <dl className="mt-4 space-y-1.5 border-t border-line-soft pt-3 text-[13px]">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Sold by</dt>
                <dd className="text-ink">Vertex Infosolutions</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Payment</dt>
                <dd className="text-ink">
                  {market.domestic
                    ? "UPI, card or net banking, on the provider's own page"
                    : "Card or PayPal, on the provider's own page"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Invoice</dt>
                <dd className="text-ink">
                  {market.domestic
                    ? "GST invoice, with your GSTIN if you give one"
                    : "Commercial invoice, zero-rated export"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Refunds</dt>
                <dd className="text-ink">
                  Full refund before the key is revealed
                </dd>
              </div>
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
  // ones is a different product from a 4.2 made entirely of fours.
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
          this licence was fulfilled.
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
