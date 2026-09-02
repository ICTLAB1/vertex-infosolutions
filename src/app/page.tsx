import Link from "next/link";

import { Glyph } from "@/components/glyph";
import { ProductCard } from "@/components/product-card";
import { getByCategory, getCategories, getFeatured } from "@/lib/catalogue";
import { FREE_SHIPPING_THRESHOLD_MINOR } from "@/lib/delivery";
import { formatMoney } from "@/lib/money";

export default async function HomePage() {
  const [categories, featured, laptops, software] = await Promise.all([
    getCategories(),
    getFeatured(),
    getByCategory("laptops", 4),
    getByCategory("software", 4),
  ]);

  return (
    <div className="pb-4">
      {/* The opening band carries the two things a first-time buyer wants to
          know — what this shop sells, and what happens after they pay. */}
      <section className="bg-nav-2 text-white">
        <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-8 lg:grid-cols-[1.4fr_1fr] lg:py-12">
          <div className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-amber">
              Business IT, bought like retail
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
              Laptops, monitors and licences — priced online, delivered with a
              GST invoice.
            </h1>
            <p className="mt-3 text-white/75">
              No quotation to chase and no callback to wait for. Pick what you
              need, pay by UPI or card, and get a tax invoice the same day.
              Licence keys arrive by email the moment payment clears.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/s"
                className="btn-amber rounded-md px-5 py-2.5 text-[15px] font-semibold"
              >
                Browse the catalogue
              </Link>
              <Link
                href="/s?category=software"
                className="rounded-md border border-white/30 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-white/10"
              >
                Software licences
              </Link>
            </div>
          </div>

          <ul className="grid content-start gap-3 text-sm">
            {[
              {
                title: "Free delivery over " + formatMoney(FREE_SHIPPING_THRESHOLD_MINOR),
                body: "Flat ₹79 below that, charged only on items we actually ship.",
              },
              {
                title: "Keys issued on payment",
                body: "Software is delivered to your inbox in seconds, not in a working day.",
              },
              {
                title: "7-day returns on hardware",
                body: "Unopened and undamaged, collected from your address.",
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
        <section className="-mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/s?category=${category.slug}`}
              className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-4 text-center transition-shadow hover:shadow-md"
            >
              <Glyph
                name={glyphForCategory(category.slug)}
                className="h-12 w-12 text-nav-2"
              />
              <span className="text-[13px] font-semibold text-ink">
                {category.name}
              </span>
            </Link>
          ))}
        </section>

        <Row title="Picked for small teams" href="/s" products={featured} />
        <Row
          title="Business laptops"
          href="/s?category=laptops"
          products={laptops}
        />
        <Row
          title="Licences, delivered by email"
          href="/s?category=software"
          products={software}
        />
      </div>
    </div>
  );
}

function glyphForCategory(slug: string): string {
  const map: Record<string, string> = {
    laptops: "laptop",
    monitors: "monitor",
    printers: "printer",
    networking: "router",
    storage: "ssd",
    software: "licence",
  };
  return map[slug] ?? "box";
}

function Row({
  title,
  href,
  products,
}: {
  title: string;
  href: string;
  products: Awaited<ReturnType<typeof getFeatured>>;
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
      {/* A row scrolls rather than wrapping. A category with three products
          then fills its row instead of leaving two empty cells, and one with
          nine does not push the next section off the screen. */}
      <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {products.map((product) => (
          <li
            key={product.id}
            className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%] xl:w-[19%]"
          >
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
