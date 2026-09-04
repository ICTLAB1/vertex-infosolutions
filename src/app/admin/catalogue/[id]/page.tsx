import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, PriceForm } from "@/components/admin-forms";
import {
  AddPriceForm,
  ClearPriceForm,
  DeleteProductForm,
  DeleteVariantForm,
  ProductDetailsForm,
  QuoteOnlyForm,
  VariantForm,
} from "@/components/admin-catalogue-forms";
import { requireAdmin } from "@/lib/admin";
import { specsToText, TERM_LABELS } from "@/lib/catalogue";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { discountPercent, formatMoneyExact } from "@/lib/money";
import { setProductPublished } from "../../admin-actions";

export const metadata: Metadata = { title: "Listing" };

const CURRENCIES: CurrencyCode[] = ["INR", "USD"];

/** Minor units back into what somebody types into a price book. */
function major(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * One listing, and everything about it.
 *
 * Laid out in the order somebody works: what it says, then what it sells and
 * for how much, then whether it is on sale, and last — behind a typed
 * confirmation — removing it. The two irreversible controls, deleting and
 * turning on quote-only, are at the bottom and marked; everything above them
 * can be undone by editing again.
 */
export default async function AdminProductPage(
  props: PageProps<"/admin/catalogue/[id]">,
) {
  await requireAdmin("/admin/catalogue");
  const { id } = await props.params;

  const [product, brands, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        summary: true,
        bullets: true,
        specs: true,
        term: true,
        logo: true,
        brandId: true,
        categoryId: true,
        featured: true,
        published: true,
        quoteOnly: true,
        cspNewTenant: true,
        brand: { select: { name: true } },
        variants: {
          orderBy: { seats: "asc" },
          select: {
            id: true,
            sku: true,
            partNumber: true,
            name: true,
            seats: true,
            prices: {
              select: { id: true, currency: true, listMinor: true, priceMinor: true },
            },
            _count: { select: { orderItems: true } },
          },
        },
      },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!product) notFound();

  const priceCount = product.variants.reduce((n, v) => n + v.prices.length, 0);
  const sold = product.variants.reduce((n, v) => n + v._count.orderItems, 0);
  const terms = Object.entries(TERM_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6">
      <p className="text-[13px]">
        <Link href="/admin/catalogue" className="text-link hover:underline">
          ← All listings
        </Link>
      </p>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{product.name}</h1>
        <div className="flex items-baseline gap-3 text-[13px]">
          {product.published ? (
            <span className="rounded bg-ok/10 px-2 py-0.5 font-semibold text-ok">On sale</span>
          ) : (
            <span className="rounded bg-deal/10 px-2 py-0.5 font-semibold text-deal">
              Withdrawn
            </span>
          )}
          <Link
            href={`/product/${product.slug}`}
            target="_blank"
            className="text-link hover:underline"
          >
            View in the store
          </Link>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {product.brand.name} ·{" "}
        {sold === 0
          ? "never sold"
          : `sold ${sold} ${sold === 1 ? "time" : "times"}`}
        {" · "}
        <span className="font-mono">/product/{product.slug}</span>
      </p>

      <section className="mt-5 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-[16px] font-bold text-ink">What the page says</h2>
        <div className="mt-3">
          <ProductDetailsForm
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              summary: product.summary,
              bullets: product.bullets,
              brandId: product.brandId,
              categoryId: product.categoryId,
              term: product.term,
              logo: product.logo,
              cspNewTenant: product.cspNewTenant,
              featured: product.featured,
            }}
            brands={brands}
            categories={categories}
            terms={terms}
            specsText={specsToText(product.specs)}
          />
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-[16px] font-bold text-ink">What it sells, and for how much</h2>
        <p className="mt-1 text-[13px] text-muted">
          {product.quoteOnly
            ? "This listing is quoted per order, so it holds no prices at all. That is what stops a made-up figure ever reaching a customer."
            : "A line with no price in a market is not shown, not addable and not buyable there — silently. Red below means exactly that."}
        </p>

        <ul className="mt-3 space-y-4">
          {product.variants.map((variant) => (
            <li key={variant.id} className="rounded-md border border-line-soft bg-ground/30 p-3">
              <VariantForm productId={product.id} variant={variant} />

              {!product.quoteOnly ? (
                <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
                  {CURRENCIES.map((currency) => {
                    const price = variant.prices.find((row) => row.currency === currency);
                    if (!price) {
                      return (
                        <div key={currency}>
                          <p className="mb-1 text-[12px] font-semibold text-deal">
                            Not sold in {currency}.
                          </p>
                          <AddPriceForm variantId={variant.id} currency={currency} />
                        </div>
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
                          Shows as {formatMoneyExact(price.priceMinor, currency)}
                          {off > 0 ? `, ${off}% off list` : ", no saving shown"}
                          {currency === "INR" ? " · GST included" : " · zero-rated export"}
                        </p>
                        <ClearPriceForm priceId={price.id} currency={currency} />
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {variant._count.orderItems === 0 && product.variants.length > 1 ? (
                <div className="mt-3 border-t border-line pt-3">
                  <DeleteVariantForm variantId={variant.id} sku={variant.sku} />
                </div>
              ) : (
                <p className="mt-3 border-t border-line pt-3 text-[12px] text-faint">
                  {variant._count.orderItems > 0
                    ? `Sold ${variant._count.orderItems} ${variant._count.orderItems === 1 ? "time" : "times"}, so it stays — an order has to remain explainable. Clearing its prices takes it off sale.`
                    : "The only thing this listing sells, so it stays. Withdraw the listing instead."}
                </p>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-md border border-dashed border-line p-3">
          <h3 className="text-[14px] font-semibold text-ink">Add another line</h3>
          <p className="mb-2 text-[12px] text-faint">
            A second seat count, a different term. It arrives with no price, so
            nothing changes in the shop until you give it one.
          </p>
          <VariantForm productId={product.id} />
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-[16px] font-bold text-ink">Whether it is on sale</h2>
        <div className="mt-3 flex flex-wrap gap-6">
          <ActionForm
            action={setProductPublished}
            fields={{
              productId: product.id,
              published: product.published ? "false" : "true",
            }}
            label={product.published ? "Withdraw from sale" : "Put back on sale"}
            busy={product.published ? "Withdrawing…" : "Restoring…"}
            tone={product.published ? "loud" : "quiet"}
            note={
              product.published
                ? "It disappears from the shop, the search and the sitemap, and keeps its orders and its address."
                : "Nobody can see this listing at the moment."
            }
          />
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-deal/30 bg-deal/[0.03] p-5">
        <h2 className="text-[16px] font-bold text-deal">Changes that cannot be undone</h2>
        <div className="mt-3 space-y-5">
          <div>
            <h3 className="text-[14px] font-semibold text-ink">How it is priced</h3>
            <p className="mb-2 text-[12px] text-muted">
              {product.quoteOnly
                ? "Currently quoted per order. Turning this off puts it back on the ordinary buying path, where it needs a price in each market before anyone can buy it."
                : "Turning this on removes every price on the listing and sends customers to the enquiry form instead. For a publisher whose price book we do not hold."}
            </p>
            <QuoteOnlyForm
              productId={product.id}
              quoteOnly={product.quoteOnly}
              priceCount={priceCount}
            />
          </div>

          <div className="border-t border-deal/20 pt-4">
            <DeleteProductForm productId={product.id} name={product.name} />
          </div>
        </div>
      </section>
    </div>
  );
}
