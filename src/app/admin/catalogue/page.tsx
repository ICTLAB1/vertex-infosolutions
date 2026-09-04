import type { Metadata } from "next";
import Link from "next/link";

import { BulkPublishForm } from "@/components/admin-catalogue-forms";
import { requireAdmin } from "@/lib/admin";
import { TERM_LABELS } from "@/lib/catalogue";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoneyExact } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Catalogue" };

const CURRENCIES: CurrencyCode[] = ["INR", "USD"];
const PER_PAGE = 40;

/**
 * The catalogue, as a list you can find things in.
 *
 * It used to render every listing in full, in one page, in alphabetical order.
 * At five hundred products that is a page nobody can use: finding one means
 * scrolling past four hundred and ninety-nine, and the browser has to lay out
 * two thousand form fields to show it. So this is a list — searchable,
 * filtered, forty at a time — and everything about one listing now lives on
 * that listing's own page.
 *
 * The filters are the part worth having. "Not on sale in one market" and
 * "never priced" are the two states that lose money silently: a listing that
 * looks perfect in the back office and cannot be bought in India, and one that
 * cannot be bought at all. Both are one click from here.
 */
type Status = "all" | "live" | "withdrawn" | "quoted" | "gap" | "unpriced";

const STATUS_LABELS: Record<Status, string> = {
  all: "Everything",
  live: "On sale",
  withdrawn: "Withdrawn",
  quoted: "Quoted per order",
  gap: "Missing one market",
  unpriced: "No price at all",
};

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : (value ?? "")).trim();
}

export default async function AdminCataloguePage(
  props: PageProps<"/admin/catalogue">,
) {
  await requireAdmin("/admin/catalogue");
  const search = await props.searchParams;

  const q = one(search.q);
  const brandSlug = one(search.brand);
  const categorySlug = one(search.category);
  const statusRaw = one(search.status);
  const status: Status = (
    statusRaw in STATUS_LABELS ? statusRaw : "all"
  ) as Status;
  const page = Math.max(1, Number(one(search.page)) || 1);

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
      {
        variants: {
          some: { partNumber: { contains: q, mode: "insensitive" } },
        },
      },
    ];
  }
  if (brandSlug) where.brand = { slug: brandSlug };
  if (categorySlug) where.category = { slug: categorySlug };

  if (status === "live") where.published = true;
  if (status === "withdrawn") where.published = false;
  if (status === "quoted") where.quoteOnly = true;
  // Both of the money-losing states exclude quote-only listings, which hold no
  // price on purpose — counting them here would make the warning permanent,
  // and a warning that is always on is a warning nobody reads.
  if (status === "unpriced") {
    where.quoteOnly = false;
    where.variants = { every: { prices: { none: {} } } };
  }
  if (status === "gap") {
    where.quoteOnly = false;
    where.AND = [
      { variants: { some: { prices: { some: {} } } } },
      {
        OR: CURRENCIES.map((currency) => ({
          variants: { some: { prices: { none: { currency } } } },
        })),
      },
    ];
  }

  const [brands, categories, total, products, counts] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    prisma.category.findMany({
      orderBy: { position: "asc" },
      select: { slug: true, name: true },
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        slug: true,
        term: true,
        featured: true,
        published: true,
        quoteOnly: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
        variants: {
          orderBy: { seats: "asc" },
          select: {
            sku: true,
            prices: { select: { currency: true, priceMinor: true } },
          },
        },
      },
    }),
    prisma.product.groupBy({ by: ["published"], _count: true }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const live = counts.find((row) => row.published)?._count ?? 0;
  const off = counts.find((row) => !row.published)?._count ?? 0;

  // Carried onto every filter link so changing one filter keeps the others,
  // and always resets the page — page 7 of a different filter is a blank.
  const linkTo = (changes: Record<string, string>) => {
    const params = new URLSearchParams();
    const current = {
      q,
      brand: brandSlug,
      category: categorySlug,
      status: statusRaw,
    };
    for (const [key, value] of Object.entries({ ...current, ...changes })) {
      if (value && value !== "all") params.set(key, value);
    }
    const query = params.toString();
    return query ? `/admin/catalogue?${query}` : "/admin/catalogue";
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Catalogue</h1>
          <p className="mt-1 text-[14px] text-muted">
            {live} on sale, {off} withdrawn. Changing a price changes what the
            next customer is charged; orders already placed keep what they were
            sold at.
          </p>
        </div>
        <Link
          href="/admin/catalogue/new"
          className="btn-amber rounded-full px-5 py-2 text-[14px] font-semibold"
        >
          Add a listing
        </Link>
      </div>

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        action="/admin/catalogue"
      >
        <label className="min-w-[16rem] flex-1">
          <span className="block text-[12px] font-semibold text-muted">
            Search by name, address, SKU or the publisher&apos;s number
          </span>
          <input
            name="q"
            defaultValue={q}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-[14px]"
          />
        </label>
        {brandSlug ? (
          <input type="hidden" name="brand" value={brandSlug} />
        ) : null}
        {categorySlug ? (
          <input type="hidden" name="category" value={categorySlug} />
        ) : null}
        {statusRaw && statusRaw !== "all" ? (
          <input type="hidden" name="status" value={statusRaw} />
        ) : null}
        <button
          type="submit"
          className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-link hover:bg-ground/60"
        >
          Search
        </button>
        {q ? (
          <Link
            href={linkTo({ q: "" })}
            className="text-[13px] text-link hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-3 space-y-2 text-[13px]">
        <Row label="Show">
          {(Object.keys(STATUS_LABELS) as Status[]).map((key) => (
            <Chip key={key} href={linkTo({ status: key })} on={status === key}>
              {STATUS_LABELS[key]}
            </Chip>
          ))}
        </Row>
        <Row label="Publisher">
          <Chip href={linkTo({ brand: "" })} on={!brandSlug}>
            All
          </Chip>
          {brands.map((brand) => (
            <Chip
              key={brand.slug}
              href={linkTo({ brand: brand.slug })}
              on={brandSlug === brand.slug}
            >
              {brand.name}
            </Chip>
          ))}
        </Row>
        <Row label="Shelf">
          <Chip href={linkTo({ category: "" })} on={!categorySlug}>
            All
          </Chip>
          {categories.map((category) => (
            <Chip
              key={category.slug}
              href={linkTo({ category: category.slug })}
              on={categorySlug === category.slug}
            >
              {category.name}
            </Chip>
          ))}
        </Row>
      </div>

      <p className="mt-4 text-[13px] text-muted">
        {total === 0
          ? "Nothing matches."
          : `${total} ${total === 1 ? "listing" : "listings"}${pages > 1 ? `, page ${page} of ${pages}` : ""}.`}
      </p>

      <div className="mt-2">
        {products.length === 0 ? null : (
          <BulkPublishForm>
            <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line bg-surface">
              {products.map((product) => {
                const priced = product.variants.flatMap((v) => v.prices);
                const gaps = product.quoteOnly
                  ? []
                  : CURRENCIES.filter(
                      (currency) =>
                        !product.variants.every((variant) =>
                          variant.prices.some(
                            (price) => price.currency === currency,
                          ),
                        ),
                    );
                return (
                  <li
                    key={product.id}
                    className="flex items-start gap-3 px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      name="productIds"
                      value={product.id}
                      aria-label={`Select ${product.name}`}
                      className="mt-1.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                        {product.brand.name} · {product.category.name} ·{" "}
                        {TERM_LABELS[product.term]}
                      </p>
                      <Link
                        href={`/admin/catalogue/${product.id}`}
                        className="text-[15px] font-bold text-ink hover:text-link hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[12px] text-faint">
                        {product.variants.length}{" "}
                        {product.variants.length === 1 ? "line" : "lines"} ·{" "}
                        {product.variants[0]?.sku ?? "no SKU"}
                        {product.variants.length > 1 ? " …" : ""}
                      </p>
                    </div>

                    <div className="w-40 shrink-0 text-right font-mono text-[13px] tabular-nums text-muted">
                      {CURRENCIES.map((currency) => {
                        const row = priced.find(
                          (price) => price.currency === currency,
                        );
                        return (
                          <p key={currency}>
                            {row ? (
                              formatMoneyExact(row.priceMinor, currency)
                            ) : (
                              <span
                                className={
                                  product.quoteOnly ? "text-faint" : "text-deal"
                                }
                              >
                                no {currency}
                              </span>
                            )}
                          </p>
                        );
                      })}
                    </div>

                    <div className="w-32 shrink-0 space-y-0.5 text-right text-[12px]">
                      {!product.published ? (
                        <span className="inline-block rounded bg-deal/10 px-2 py-0.5 font-semibold text-deal">
                          Withdrawn
                        </span>
                      ) : (
                        <span className="inline-block rounded bg-ok/10 px-2 py-0.5 font-semibold text-ok">
                          On sale
                        </span>
                      )}
                      {product.quoteOnly ? (
                        <span className="block text-amber-edge">
                          Quoted per order
                        </span>
                      ) : null}
                      {product.featured ? (
                        <span className="block text-ok">Featured</span>
                      ) : null}
                      {gaps.length > 0 ? (
                        <span className="block text-deal">
                          Not sold in {gaps.join(" or ")}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </BulkPublishForm>
        )}
      </div>

      {pages > 1 ? (
        <nav
          className="mt-4 flex items-center justify-between text-[14px]"
          aria-label="Pages"
        >
          {page > 1 ? (
            <Link
              href={`${linkTo({})}${linkTo({}).includes("?") ? "&" : "?"}page=${page - 1}`}
              className="text-link hover:underline"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link
              href={`${linkTo({})}${linkTo({}).includes("?") ? "&" : "?"}page=${page + 1}`}
              className="text-link hover:underline"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-16 shrink-0 text-[12px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-[13px] ${
        on
          ? "border-ink bg-ink font-semibold text-white"
          : "border-line bg-surface text-muted hover:bg-ground/60"
      }`}
    >
      {children}
    </Link>
  );
}
