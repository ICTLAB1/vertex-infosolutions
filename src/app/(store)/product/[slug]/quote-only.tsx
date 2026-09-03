import Link from "next/link";

import { Assurance } from "@/components/assurance";
import { ProductImage } from "@/components/product-image";
import { specRows, TERM_LABELS, TERM_NOTES, type CatalogueProduct } from "@/lib/catalogue";
import { absolute, jsonLd } from "@/lib/seo";

/**
 * A product we sell without a published price.
 *
 * Autodesk is the case this exists for. The licences are real and the reseller
 * agreement is real; what we do not hold is the price book, and the honest
 * answer to "how much" is a quote rather than a number somebody invented.
 *
 * Everything a shopper needs to decide is still here — what it is, what it
 * covers, the term, the licensing details — and the only thing missing is the
 * figure, which is exactly what the panel asks for. The structured data omits
 * the offer entirely rather than publishing an offer with no price: a search
 * engine showing "$0" or a blank price beside this name would be worse than
 * showing nothing at all.
 */
export function QuoteOnlyProduct({
  product,
  domestic,
}: {
  product: NonNullable<CatalogueProduct>;
  domestic: boolean;
}) {
  const specs = specRows(product.specs);
  const quoteHref = `/contact?about=quote&product=${encodeURIComponent(product.slug)}`;

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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
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
                // A Product with no `offers`. Structured data that disagrees
                // with the page is worse than none, and there is no price on
                // this page to agree with.
                "@type": "Product",
                name: product.name,
                description: product.summary,
                sku: product.variants[0]?.sku,
                brand: { "@type": "Brand", name: product.brand.name },
                category: product.category.name,
                ...(product.logo ? { image: absolute(product.logo) } : {}),
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

          <hr className="my-3 border-line-soft" />

          <p className="text-2xl font-bold text-ink">Price on request</p>
          <p className="mt-1 max-w-2xl text-[14px] text-muted">
            {product.brand.name} licences are quoted rather than shelved. Tell
            us the seat count and the term and we will send a firm price,
            usually within one business day — and it is the price you pay, with
            nothing added at checkout.
          </p>

          <p className="mt-3 inline-flex rounded-md border border-line bg-ground/60 px-3 py-1.5 text-[13px]">
            <span className="font-semibold text-ink">
              {TERM_LABELS[product.term]}
            </span>
            <span className="px-1.5 text-faint">·</span>
            <span className="text-muted">{TERM_NOTES[product.term]}</span>
          </p>

          <Assurance
            brand={product.brand.name}
            domestic={domestic}
            sku={null}
          />

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
                      Available as
                    </th>
                    <td className="px-3 py-2 text-muted">
                      {product.variants.map((v) => v.name).join(" · ")}
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
                  <tr>
                    <th
                      scope="row"
                      className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
                    >
                      Pricing
                    </th>
                    <td className="px-3 py-2 text-muted">
                      Quoted per order.{" "}
                      {domestic
                        ? "Indian quotes are inclusive of 18% GST."
                        : "Export quotes are zero-rated and carry no Indian tax."}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-2xl font-bold text-ink">Price on request</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {product.variants.length === 1
                ? product.variants[0]!.name
                : `${product.variants.length} terms available`}
            </p>

            <p className="mt-2 text-[13px] text-muted">
              <span className="font-semibold text-ok">
                Quoted within one business day
              </span>{" "}
              — a named person replies with a firm figure, not an automated
              range.
            </p>

            <Link
              href={quoteHref}
              className="btn-amber mt-4 block rounded-full py-2.5 text-center text-[15px] font-semibold"
            >
              Get a price
            </Link>

            <p className="mt-2 text-[12px] text-muted">
              Tell us the seat count and the term. Nothing is charged and no
              account is needed to ask.
            </p>

            <dl className="mt-4 space-y-1.5 border-t border-line-soft pt-3 text-[13px]">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Sold by</dt>
                <dd className="text-ink">Vertex Infosolutions</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Licensing</dt>
                <dd className="text-ink">
                  Named-user subscription through your own{" "}
                  {product.brand.name} account
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-faint">Invoice</dt>
                <dd className="text-ink">
                  {domestic
                    ? "GST invoice, with your GSTIN if you give one"
                    : "Commercial invoice, zero-rated export"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
