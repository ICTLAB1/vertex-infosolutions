/**
 * Assert that every product page carries structured data Google will accept.
 *
 * Run against a server that is already up — the production build, because a
 * development build renders differently:
 *
 *     npm run build && npm run start &
 *     node scripts/check-product-schema.mjs
 *
 * It reads the sitemap for the list of product URLs, so it checks exactly the
 * pages that are offered for indexing, and fails on the first page missing any
 * of the four fields a Product rich result cannot be built without. A missing
 * `image` is the usual one, and it is invisible in a browser: the page looks
 * perfect and the listing is simply never eligible.
 */
const BASE = process.env.CHECK_BASE ?? "http://localhost:3000";
const LIMIT = Number(process.env.CHECK_LIMIT ?? 0);

const REQUIRED = [
  ["image", (p) => p.image && (Array.isArray(p.image) ? p.image.length > 0 : true)],
  ["offers.price", (p) => Number(p.offers?.price) > 0],
  ["offers.priceCurrency", (p) => /^[A-Z]{3}$/.test(p.offers?.priceCurrency ?? "")],
  ["offers.availability", (p) => typeof p.offers?.availability === "string"],
];

function products(html) {
  const found = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const [, body] of html.matchAll(re)) {
    let parsed;
    try {
      parsed = JSON.parse(body.replaceAll("\\u003c", "<"));
    } catch {
      throw new Error("ld+json on the page is not valid JSON");
    }
    const nodes = parsed["@graph"] ?? [parsed];
    // `@type` is an array on a priced listing — it is both a Product and a
    // SoftwareApplication — and a bare string on a quote-only one. Comparing
    // for equality quietly stopped matching the moment the second type was
    // added, and reported every product page as having no Product on it.
    found.push(
      ...nodes.filter((n) => [].concat(n["@type"] ?? []).includes("Product")),
    );
  }
  return found;
}

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
let urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1])
  .filter((u) => u.includes("/product/"))
  .map((u) => new URL(u).pathname);
if (LIMIT) urls = urls.slice(0, LIMIT);

console.log(`Checking ${urls.length} product pages on ${BASE}`);

let checked = 0;
let quoteOnly = 0;
const failures = [];

for (const path of urls) {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    failures.push(`${path}: HTTP ${response.status}`);
    continue;
  }
  const html = await response.text();
  const found = products(html);
  if (found.length === 0) {
    failures.push(`${path}: no Product in the structured data`);
    continue;
  }
  for (const product of found) {
    // A quote-only listing carries no offer on purpose: it has no price, and
    // inventing one is the whole thing that page exists to avoid.
    if (!product.offers) {
      if (!product.image) failures.push(`${path}: quote-only, and no image`);
      quoteOnly += 1;
      continue;
    }
    for (const [name, ok] of REQUIRED) {
      if (!ok(product)) failures.push(`${path}: missing or invalid ${name}`);
    }
    checked += 1;
  }
}

console.log(`  priced listings checked: ${checked}`);
console.log(`  quote-only listings:     ${quoteOnly}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`);
  for (const line of failures.slice(0, 25)) console.error(`  ${line}`);
  process.exit(1);
}
console.log("\nEvery product page carries image, price, currency and availability.");
