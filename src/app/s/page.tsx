import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { browse, getBrands, getCategories } from "@/lib/catalogue";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Browse" };

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | undefined {
  const value = params[key];
  const found = Array.isArray(value) ? value[0] : value;
  return found?.trim() || undefined;
}

const PRICE_BANDS = [
  { label: "Under ₹15,000", max: 15_000_00 },
  { label: "Under ₹50,000", max: 50_000_00 },
  { label: "Under ₹1,00,000", max: 100_000_00 },
];

const SORTS = [
  { value: "relevance", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Customer rating" },
] as const;

export default async function BrowsePage(props: PageProps<"/s">) {
  const params = (await props.searchParams) as Params;

  const q = one(params, "q");
  const category = one(params, "category");
  const brand = one(params, "brand");
  const maxPriceRaw = one(params, "maxPrice");
  const minRatingRaw = one(params, "minRating");
  const inStockOnly = one(params, "inStock") === "1";
  const sort = (one(params, "sort") ?? "relevance") as
    (typeof SORTS)[number]["value"];

  const maxPrice = maxPriceRaw ? Number.parseInt(maxPriceRaw, 10) : undefined;
  const minRating = minRatingRaw ? Number.parseInt(minRatingRaw, 10) : undefined;

  const [products, categories, brands] = await Promise.all([
    browse({
      q,
      category,
      brand,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
      minRating: Number.isFinite(minRating) ? minRating : undefined,
      inStockOnly,
      sort,
    }),
    getCategories(),
    getBrands(),
  ]);

  /** A link that keeps the current filters and changes one of them. */
  function withParam(key: string, value: string | undefined): string {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const single = Array.isArray(v) ? v[0] : v;
      if (single) next.set(k, single);
    }
    if (value === undefined) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    return query ? `/s?${query}` : "/s";
  }

  const activeCategory = categories.find((c) => c.slug === category);
  const heading = q
    ? `Results for “${q}”`
    : (activeCategory?.name ?? "All products");

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-6 text-sm">
          <FilterGroup title="Category">
            <FilterLink href={withParam("category", undefined)} active={!category}>
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

          <FilterGroup title="Brand">
            <FilterLink href={withParam("brand", undefined)} active={!brand}>
              All brands
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

          <FilterGroup title="Price">
            <FilterLink href={withParam("maxPrice", undefined)} active={!maxPrice}>
              Any price
            </FilterLink>
            {PRICE_BANDS.map((band) => (
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

          <FilterGroup title="Availability">
            <FilterLink
              href={withParam("inStock", inStockOnly ? undefined : "1")}
              active={inStockOnly}
            >
              In stock only
            </FilterLink>
          </FilterGroup>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
            <div>
              <h1 className="text-lg font-bold text-ink">{heading}</h1>
              <p className="text-[13px] text-muted">
                {products.length === 1
                  ? "1 product"
                  : `${products.length} products`}
                {maxPrice ? ` under ${formatMoney(maxPrice)}` : ""}
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

          {products.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface p-10 text-center">
              <p className="text-lg font-semibold text-ink">
                Nothing matched those filters.
              </p>
              <p className="mt-1 text-muted">
                Try removing a filter, or search for a brand or SKU.
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
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
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
