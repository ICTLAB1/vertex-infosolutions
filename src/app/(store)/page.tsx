import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { getMarket } from "@/lib/cart";
import { getBrands, getByBrand, getCategories, getFeatured } from "@/lib/catalogue";
import type { CurrencyCode } from "@/lib/market";

export default async function HomePage() {
  const market = await getMarket();
  const currency = market.currency;

  const [categories, brands, featured, microsoft, adobe, autodesk] =
    await Promise.all([
      getCategories(),
      getBrands(),
      getFeatured(currency),
      getByBrand("microsoft", currency, 6),
      getByBrand("adobe", currency, 6),
      getByBrand("autodesk", currency, 6),
    ]);

  return (
    <div className="pb-4">
      <section className="bg-nav-2 text-white">
        <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-8 lg:grid-cols-[1.4fr_1fr] lg:py-12">
          <div className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-amber">
              Microsoft · Adobe · Autodesk
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
              Genuine software licences, priced openly and delivered in minutes.
            </h1>
            <p className="mt-3 text-white/75">
              No quotation to chase and no callback to wait for. Pick your
              seats, pay, and the keys are in your inbox before you close the
              tab.{" "}
              {market.domestic
                ? "Prices in rupees, GST included, with a tax invoice carrying your GSTIN."
                : "Prices in US dollars, with a commercial invoice by email."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/s"
                className="btn-amber rounded-md px-5 py-2.5 text-[15px] font-semibold"
              >
                Browse the catalogue
              </Link>
              <Link
                href="/licensing"
                className="rounded-md border border-white/30 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-white/10"
              >
                How licensing works
              </Link>
            </div>
          </div>

          <ul className="grid content-start gap-3 text-sm">
            {[
              {
                title: "Licences within one business day",
                body: "Posted to your account and emailed to you. Nothing is shipped, so no carrier and no customs.",
              },
              {
                title: market.domestic
                  ? "GST invoice with your GSTIN"
                  : "Zero-rated export invoice",
                body: market.domestic
                  ? "Prices include 18% GST. Give us your GSTIN at checkout and your accounts team can claim the input credit."
                  : "No Indian tax is added. Whatever your own country charges on imported software is between you and them.",
              },
              {
                title: "Nothing renews behind your back",
                body: "We remind you a month before a subscription expires. Renewing is a decision you make, not one made for you.",
              },
            ].map((item) => (
              <li
                key={item.title}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-3"
              >
                <p className="font-semibold text-white">{item.title}</p>
                <p className="mt-0.5 text-white/70">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] px-4">
        <section className="-mt-4 grid gap-3 sm:grid-cols-3">
          {brands.map((brand) => (
            <Link
              key={brand.slug}
              href={`/s?brand=${brand.slug}`}
              className="rounded-lg border border-line bg-surface p-4 transition-shadow hover:shadow-md"
            >
              <p className="text-[16px] font-bold text-ink">{brand.name}</p>
              <p className="mt-0.5 text-[13px] text-muted">{brand.blurb}</p>
            </Link>
          ))}
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/s?category=${category.slug}`}
              className="rounded-lg border border-line bg-surface px-4 py-3 text-center transition-shadow hover:shadow-md"
            >
              <span className="text-[13px] font-semibold text-ink">
                {category.name}
              </span>
            </Link>
          ))}
        </section>

        <Row
          title="Most bought"
          href="/s"
          products={featured}
          currency={currency}
          domestic={market.domestic}
        />
        <Row
          title="Microsoft"
          href="/s?brand=microsoft"
          products={microsoft}
          currency={currency}
          domestic={market.domestic}
        />
        <Row
          title="Adobe"
          href="/s?brand=adobe"
          products={adobe}
          currency={currency}
          domestic={market.domestic}
        />
        <Row
          title="Autodesk"
          href="/s?brand=autodesk"
          products={autodesk}
          currency={currency}
          domestic={market.domestic}
        />

        <section className="mt-6 rounded-lg border border-line bg-surface p-5">
          <h2 className="text-[16px] font-bold text-ink">
            An authorised reseller, not the publisher
          </h2>
          <p className="mt-1 max-w-3xl text-[14px] text-muted">
            Every licence here is supplied under Microsoft&apos;s, Adobe&apos;s
            or Autodesk&apos;s own end-user terms, which you accept when you
            activate it. We sell and support the licence; they own the software.
            Anyone offering these at a fraction of the prices on this page is
            selling you something that will stop working.{" "}
            <Link href="/licensing" className="text-link underline">
              How licensing works
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({
  title,
  href,
  products,
  currency,
  domestic,
}: {
  title: string;
  href: string;
  products: Awaited<ReturnType<typeof getFeatured>>;
  currency: CurrencyCode;
  domestic: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mt-6 rounded-lg border border-line bg-surface p-4">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        <Link href={href} className="text-sm text-link hover:underline">
          See all
        </Link>
      </div>
      {/* A row scrolls rather than wrapping, so a publisher with three products
          fills its row instead of leaving empty cells. */}
      <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {products.map((product) => (
          <li
            key={product.id}
            className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%] xl:w-[19%]"
          >
            <ProductCard
              product={product}
              currency={currency}
              domestic={domestic}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
