import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm, PriceForm } from "@/components/admin-forms";
import { requireAdmin } from "@/lib/admin";
import { setProductFeatured, setProductPublished } from "../admin-actions";
import { TERM_LABELS } from "@/lib/catalogue";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { discountPercent, formatMoneyExact } from "@/lib/money";

export const metadata: Metadata = { title: "Catalogue" };

const CURRENCIES: CurrencyCode[] = ["INR", "USD"];

/** Minor units back into what somebody types into a price book. */
function major(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * The price book.
 *
 * Prices only. Products, variants and copy are seeded from
 * `prisma/seed.ts` — they change when the catalogue is rebuilt, not on a
 * Tuesday afternoon, and a form that could rename a product is a form that can
 * rename a product by accident. What does change often is a number, so that is
 * what this edits.
 *
 * The missing-price warning is the important part of the page: a variant with
 * no row in a currency is invisible to that entire market, silently. That is
 * the single easiest way to stop selling to India without noticing.
 */
export default async function AdminCataloguePage() {
  await requireAdmin("/admin/catalogue");

  const products = await prisma.product.findMany({
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
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
          id: true,
          sku: true,
          partNumber: true,
          name: true,
          seats: true,
          prices: { select: { id: true, currency: true, listMinor: true, priceMinor: true } },
        },
      },
    },
  });

  // A quote-only product has no price by design, so it is not a gap. Counting
  // it here would put a permanent red banner on the page, and a warning that
  // is always on is a warning nobody reads.
  const missing = products
    .filter((product) => !product.quoteOnly)
    .flatMap((product) =>
      product.variants.flatMap((variant) =>
        CURRENCIES.filter(
          (currency) =>
            !variant.prices.some((price) => price.currency === currency),
        ).map((currency) => ({ sku: variant.sku, currency })),
      ),
    );

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <h1 className="text-2xl font-bold text-ink">Catalogue</h1>
      <p className="mt-1 text-[14px] text-muted">
        {products.length} products. Changing a price here changes what the next
        customer is charged; orders already placed keep what they were sold at.
      </p>

      {missing.length > 0 ? (
        <section className="mt-4 rounded-lg border border-deal/40 bg-deal/5 p-4">
          <h2 className="text-[15px] font-bold text-deal">
            {missing.length} {missing.length === 1 ? "SKU is" : "SKUs are"} not on
            sale in one of the two markets
          </h2>
          <p className="mt-1 text-[13px] text-deal/90">
            A variant with no price in a currency is not shown, not addable and
            not buyable in that market — silently. These need a row before they
            can be sold.
          </p>
          <ul className="mt-2 font-mono text-[13px] text-deal/90">
            {missing.map((gap) => (
              <li key={`${gap.sku}-${gap.currency}`}>
                {gap.sku} — no {gap.currency} price
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-5 space-y-4">
        {products.map((product) => (
          <section
            key={product.id}
            className="rounded-lg border border-line bg-surface p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  {product.brand.name} · {product.category.name}
                </p>
                <h2 className="text-[16px] font-bold text-ink">{product.name}</h2>
              </div>
              <div className="flex items-baseline gap-3 text-[13px]">
                {!product.published ? (
                  <span className="rounded bg-deal/10 px-2 py-0.5 font-semibold text-deal">
                    Withdrawn
                  </span>
                ) : null}
                {product.quoteOnly ? (
                  <span className="rounded bg-amber/20 px-2 py-0.5 font-semibold text-ink">
                    Quoted per order
                  </span>
                ) : null}
                {product.featured ? (
                  <span className="rounded bg-ok/10 px-2 py-0.5 font-semibold text-ok">
                    Featured
                  </span>
                ) : null}
                <span className="text-muted">{TERM_LABELS[product.term]}</span>
                <Link
                  href={`/product/${product.slug}`}
                  target="_blank"
                  className="text-link hover:underline"
                >
                  View in the store
                </Link>
              </div>
            </div>

            <ul className="mt-3 space-y-3">
              {product.variants.map((variant) => (
                <li
                  key={variant.id}
                  className="rounded-md border border-line-soft bg-ground/30 p-3"
                >
                  <p className="text-[14px] font-semibold text-ink">
                    {variant.name}
                    <span className="ml-2 font-mono text-[12px] font-normal text-faint">
                      {variant.partNumber ? `${variant.partNumber} · ` : ""}
                      {variant.sku}
                    </span>
                    {variant.seats > 1 ? (
                      <span className="ml-2 text-[12px] font-normal text-muted">
                        {variant.seats} seats
                      </span>
                    ) : null}
                  </p>

                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {CURRENCIES.map((currency) => {
                      const price = variant.prices.find(
                        (row) => row.currency === currency,
                      );
                      if (!price) {
                        return (
                          <p
                            key={currency}
                            className={`self-center text-[13px] font-semibold ${
                              product.quoteOnly ? "text-muted" : "text-deal"
                            }`}
                          >
                            {product.quoteOnly
                              ? `No ${currency} price — quoted per order.`
                              : `No ${currency} price — not sold in that market.`}
                          </p>
                        );
                      }
                      const off = discountPercent(price.listMinor, price.priceMinor);
                      return (
                        <div key={currency}>
                          <PriceForm
                            priceId={price.id}
                            currency={currency}
                            price={major(price.priceMinor)}
                            list={major(price.listMinor)}
                          />
                          <p className="mt-1 text-[12px] text-faint">
                            Shows as{" "}
                            {formatMoneyExact(price.priceMinor, currency)}
                            {off > 0 ? `, ${off}% off list` : ", no saving shown"}
                            {currency === "INR" ? " · GST included" : " · zero-rated export"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>

            {/* Withdrawing is not deleting. The listing keeps its slug, its
                orders and its history and simply stops being offered — which
                is the honest answer to a price that turned out to be wrong. */}
            <div className="mt-3 flex flex-wrap gap-5 border-t border-line-soft pt-3">
              <ActionForm
                action={setProductPublished}
                fields={{
                  productId: product.id,
                  published: product.published ? "false" : "true",
                }}
                label={product.published ? "Withdraw from sale" : "Put back on sale"}
                busy={product.published ? "Withdrawing…" : "Restoring…"}
                tone={product.published ? "loud" : "quiet"}
              />
              <ActionForm
                action={setProductFeatured}
                fields={{
                  productId: product.id,
                  featured: product.featured ? "false" : "true",
                }}
                label={product.featured ? "Remove from home page" : "Feature on home page"}
                busy="Saving…"
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
