import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { getMarket } from "@/lib/cart";
import {
  browse,
  getBrands,
  getCategories,
  PER_PAGE,
  TERM_LABELS,
} from "@/lib/catalogue";
import { formatMoney } from "@/lib/money";
import { absolute, jsonLd, NOINDEX, pageMetadata } from "@/lib/seo";

/**
 * What a browse page says it is, and whether it should be indexed at all.
 *
 * A shelf — "all Adobe", "everything under security" — is worth indexing: it
 * is how somebody searching for a publisher rather than a product arrives.
 * A *filtered* shelf is not. Sort order, price band, rating and free text
 * multiply into thousands of URLs holding the same products in a different
 * order, and indexing them spends the crawl budget that should have gone on
 * 499 product pages.
 *
 * So the canonical always points at the plain brand or category shelf, and
 * anything narrower is marked noindex while still being followed — the links
 * out of it lead to products worth having.
 */
export async function generateMetadata(
  props: PageProps<"/s">,
): Promise<Metadata> {
  const params = (await props.searchParams) as Params;
  const q = one(params, "q");
  const brandSlug = one(params, "brand");
  const categorySlug = one(params, "category");

  const narrowed = Boolean(
    q ||
      one(params, "term") ||
      one(params, "maxPrice") ||
      one(params, "minRating") ||
      (one(params, "sort") && one(params, "sort") !== "relevance"),
  );

  const [brands, categories] = await Promise.all([
    getBrands(),
    getCategories(),
  ]);
  const brand = brands.find((b) => b.slug === brandSlug);
  const category = categories.find((c) => c.slug === categorySlug);

  const shelf = brand?.name ?? category?.name;
  const path = brand
    ? `/s?brand=${brand.slug}`
    : category
      ? `/s?category=${category.slug}`
      : "/s";

  if (q) {
    return {
      title: `Search: ${q}`,
      alternates: { canonical: path },
      ...NOINDEX,
    };
  }

  const title = shelf ? `${shelf} licences` : "All software licences";
  const description = shelf
    ? `Buy genuine ${shelf} software licences from an authorised reseller. GST invoice on every Indian order, zero-rated exports elsewhere, and licence details issued within one business day.`
    : "Browse every Microsoft, Adobe and Autodesk licence we sell. Genuine licences from an authorised reseller, priced in INR with GST for India and USD everywhere else.";

  /*
    Every page of a shelf canonicals to itself.

    Not to page one. Pointing page six at page one was the received wisdom for
    years and Google said plainly in 2019 that it never worked that way: a
    canonical claims two URLs are the same page, and page six holds forty-eight
    products page one does not. The consequence of the old advice is that
    everything past the first forty-eight is dropped from the index.

    The page number goes in the title too, because two results reading
    "Microsoft licences" with the same description are two results a person
    cannot choose between.
  */
  const pageNumber = Math.max(1, Number.parseInt(one(params, "page") ?? "1", 10) || 1);
  const paged = pageNumber > 1;
  const canonical = paged ? `${path}${path.includes("?") ? "&" : "?"}page=${pageNumber}` : path;

  return {
    ...pageMetadata({
      title: paged ? `${title} — page ${pageNumber}` : title,
      description,
      path: canonical,
    }),
    ...(narrowed ? NOINDEX : {}),
  };
}

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | undefined {
  const value = params[key];
  const found = Array.isArray(value) ? value[0] : value;
  return found?.trim() || undefined;
}

/** Bands are per-market, because ₹5,000 and $5,000 are not the same shelf. */
const PRICE_BANDS = {
  USD: [
    { label: "Under $250", max: 250_00 },
    { label: "Under $1,000", max: 1_000_00 },
    { label: "Under $3,000", max: 3_000_00 },
  ],
  INR: [
    { label: "Under ₹20,000", max: 20_000_00 },
    { label: "Under ₹75,000", max: 75_000_00 },
    { label: "Under ₹2,00,000", max: 200_000_00 },
  ],
} as const;

const TERMS = [
  "ANNUAL_SUBSCRIPTION",
  "MONTHLY_COMMITMENT",
  "PERPETUAL",
] as const;

const SORTS = [
  { value: "relevance", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Customer rating" },
] as const;

export default async function BrowsePage(props: PageProps<"/s">) {
  const params = (await props.searchParams) as Params;
  const market = await getMarket();

  const q = one(params, "q");
  const category = one(params, "category");
  const brand = one(params, "brand");
  const term = one(params, "term");
  const maxPriceRaw = one(params, "maxPrice");
  const minRatingRaw = one(params, "minRating");
  const sort = (one(params, "sort") ?? "relevance") as
    (typeof SORTS)[number]["value"];

  const maxPrice = maxPriceRaw ? Number.parseInt(maxPriceRaw, 10) : undefined;
  const minRating = minRatingRaw ? Number.parseInt(minRatingRaw, 10) : undefined;

  const pageNumber = Math.max(1, Number.parseInt(one(params, "page") ?? "1", 10) || 1);

  const [shelf, categories, brands] = await Promise.all([
    browse(
      {
        q,
        category,
        brand,
        term,
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
        minRating: Number.isFinite(minRating) ? minRating : undefined,
        sort,
      },
      market.currency,
      pageNumber,
    ),
    getCategories(),
    getBrands(),
  ]);

  const bands = PRICE_BANDS[market.currency];

  /** A link that keeps the current filters and changes one of them. */
  function withParam(key: string, value: string | undefined): string {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const single = Array.isArray(v) ? v[0] : v;
      if (single) next.set(k, single);
    }
    // A price band from the other market is meaningless, so changing anything
    // else keeps it but switching market drops it.
    if (value === undefined) next.delete(key);
    else next.set(key, value);
    // Changing a filter goes back to the start. Page 6 of "all Adobe" is not
    // page 6 of "Adobe under $500", and landing on an empty page because the
    // narrower shelf is shorter reads as a broken filter.
    if (key !== "page") next.delete("page");
    const query = next.toString();
    return query ? `/s?${query}` : "/s";
  }

  const activeBrand = brands.find((b) => b.slug === brand);
  const activeCategory = categories.find((c) => c.slug === category);
  const heading = q
    ? `Results for “${q}”`
    : (activeBrand?.name ?? activeCategory?.name ?? "All licences");
  const blurb = activeBrand?.blurb ?? activeCategory?.blurb ?? null;
  // Only on page one. The description belongs to the shelf, not to each page
  // of it, and repeating it on every page would make forty near-identical
  // pages out of one distinctive shelf.
  const intro =
    shelf.page === 1 ? (activeBrand?.intro ?? activeCategory?.intro ?? null) : null;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-4 text-sm">
          <FilterGroup title="Publisher">
            <FilterLink href={withParam("brand", undefined)} active={!brand}>
              All publishers
            </FilterLink>
            {brands.map((item) => (
              <FilterLink
                key={item.slug}
                href={withParam("brand", item.slug)}
                active={brand === item.slug}
              >
                {item.name}
              </FilterLink>
            ))}
          </FilterGroup>

          <FilterGroup title="Category">
            <FilterLink
              href={withParam("category", undefined)}
              active={!category}
            >
              All categories
            </FilterLink>
            {categories.map((item) => (
              <FilterLink
                key={item.slug}
                href={withParam("category", item.slug)}
                active={category === item.slug}
              >
                {item.name}
              </FilterLink>
            ))}
          </FilterGroup>

          <FilterGroup title="Licence term">
            <FilterLink href={withParam("term", undefined)} active={!term}>
              Any term
            </FilterLink>
            {TERMS.map((value) => (
              <FilterLink
                key={value}
                href={withParam("term", value)}
                active={term === value}
              >
                {TERM_LABELS[value]}
              </FilterLink>
            ))}
          </FilterGroup>

          <FilterGroup title="Price">
            <FilterLink
              href={withParam("maxPrice", undefined)}
              active={!maxPrice}
            >
              Any price
            </FilterLink>
            {bands.map((band) => (
              <FilterLink
                key={band.max}
                href={withParam("maxPrice", String(band.max))}
                active={maxPrice === band.max}
              >
                {band.label}
              </FilterLink>
            ))}
          </FilterGroup>

          <FilterGroup title="Customer rating">
            <FilterLink
              href={withParam("minRating", undefined)}
              active={!minRating}
            >
              Any rating
            </FilterLink>
            {[4, 3].map((stars) => (
              <FilterLink
                key={stars}
                href={withParam("minRating", String(stars))}
                active={minRating === stars}
              >
                {stars} stars and up
              </FilterLink>
            ))}
          </FilterGroup>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
            <div>
              <h1 className="text-lg font-bold text-ink">{heading}</h1>
              <p className="text-[13px] text-muted">
                {blurb ? `${blurb} · ` : ""}
                {shelf.total === 1 ? "1 product" : `${shelf.total} products`}
                {shelf.pages > 1 ? ` · page ${shelf.page} of ${shelf.pages}` : ""}
                {maxPrice
                  ? ` under ${formatMoney(maxPrice, market.currency)}`
                  : ""}
                {market.domestic ? " · prices include GST" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="text-muted">Sort by</span>
              {SORTS.map((option) => (
                <Link
                  key={option.value}
                  href={withParam("sort", option.value)}
                  className={`rounded border px-2.5 py-1 ${
                    sort === option.value
                      ? "border-brand bg-brand/10 font-semibold text-brand"
                      : "border-line text-muted hover:border-faint"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          {/*
            The paragraph that makes this page about something.

            A shelf that is a heading over a grid of tiles carries almost no
            text of its own, so there is nothing for a search engine to decide
            it is about — which is why shop category pages usually rank for
            nothing while their product pages rank fine. Above the grid rather
            than below it, because it is written to be read by somebody who has
            just arrived and does not yet know what is on this shelf.
          */}
          {intro ? (
            <div className="mb-4 rounded-lg border border-line bg-surface px-4 py-3.5">
              <p className="max-w-[70ch] text-[14px] leading-relaxed text-muted">
                {intro}
              </p>
            </div>
          ) : null}

          {shelf.total === 0 ? (
            <div className="rounded-lg border border-line bg-surface p-10 text-center">
              <p className="text-lg font-semibold text-ink">
                Nothing matched those filters.
              </p>
              <p className="mt-1 text-muted">
                Try removing a filter, or search for a publisher or SKU.
              </p>
              <Link
                href="/s"
                className="mt-4 inline-block rounded-md border border-line px-4 py-2 font-semibold text-link hover:bg-ground"
              >
                Clear all filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {/* The shelf, in the order it is shown. A crawler that reads
                  this can follow the listing without parsing the grid, and
                  the position is the one on the page rather than an
                  alphabetical guess. */}
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: jsonLd({
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    numberOfItems: shelf.total,
                    itemListElement: shelf.items.map((product, i) => ({
                      "@type": "ListItem",
                      // Numbered from where this page starts, not from one.
                      // The forty-ninth product is the forty-ninth product
                      // whether or not it happens to be first on page two.
                      position: (shelf.page - 1) * PER_PAGE + i + 1,
                      url: absolute(`/product/${product.slug}`),
                      name: product.name,
                    })),
                  }),
                }}
              />
              {shelf.items.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={market.currency}
                  domestic={market.domestic}
                  // The first row is what Largest Contentful Paint is measured
                  // on. Everything below it stays lazy; these four are asked
                  // for immediately, because a lazy image that turns out to be
                  // the largest one is a slow page by definition.
                  eager={i < 4}
                />
              ))}
            </div>
          )}

          {shelf.pages > 1 ? (
            /*
              Real page links, not infinite scroll.

              A crawler cannot scroll, and a shopper cannot send somebody
              "the third page of Adobe" if it has no address. Every page is
              its own URL, every page canonicals to itself, and the numbers
              are links rather than buttons so they can be opened in a new
              tab and followed by anything that reads HTML.
            */
            <nav
              className="mt-5 flex flex-wrap items-center justify-center gap-1.5"
              aria-label="Pages of results"
            >
              {shelf.page > 1 ? (
                <Link
                  href={withParam("page", shelf.page === 2 ? undefined : String(shelf.page - 1))}
                  rel="prev"
                  className="rounded-md border border-line bg-surface px-3 py-1.5 text-[14px] font-semibold text-link hover:bg-ground"
                >
                  ← Previous
                </Link>
              ) : null}

              {pageWindow(shelf.page, shelf.pages).map((n, i) =>
                n === null ? (
                  <span key={`gap-${i}`} className="px-1 text-faint">
                    …
                  </span>
                ) : (
                  <Link
                    key={n}
                    href={withParam("page", n === 1 ? undefined : String(n))}
                    aria-current={n === shelf.page ? "page" : undefined}
                    className={`min-w-[2.25rem] rounded-md border px-2.5 py-1.5 text-center text-[14px] tabular-nums ${
                      n === shelf.page
                        ? "border-ink bg-ink font-bold text-white"
                        : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
                    }`}
                  >
                    {n}
                  </Link>
                ),
              )}

              {shelf.page < shelf.pages ? (
                <Link
                  href={withParam("page", String(shelf.page + 1))}
                  rel="next"
                  className="rounded-md border border-line bg-surface px-3 py-1.5 text-[14px] font-semibold text-link hover:bg-ground"
                >
                  Next →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-3">
      <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-faint">
        {title}
      </h2>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        className={`block rounded px-2 py-1 ${
          active
            ? "bg-brand/10 font-semibold text-brand"
            : "text-muted hover:bg-ground hover:text-ink"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}

/**
 * Which page numbers to show, when there are more than fit.
 *
 * Always the first and the last, always the current one and its neighbours,
 * and an ellipsis where a run is skipped. The ends matter more than they look:
 * page one is the shelf's canonical entry point and the last page is how a
 * crawler learns how deep the shelf goes, so neither is ever hidden behind a
 * "next" it would have to click forty times to reach.
 */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const wanted = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => wanted.add(n));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => wanted.add(n));

  const shown = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let previous = 0;
  for (const n of shown) {
    if (previous && n - previous > 1) out.push(null);
    out.push(n);
    previous = n;
  }
  return out;
}
