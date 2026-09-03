import Link from "next/link";

import { setMarket } from "@/app/actions";
import { CurrencySelect } from "@/components/currency-select";
import { getUser } from "@/lib/auth";
import { getCart, getMarket, totalsFor } from "@/lib/cart";
import { getBrands, getCategories } from "@/lib/catalogue";

/**
 * The wordmark. A vertex is the point where two lines meet, so the mark is
 * exactly that — drawn once here rather than shipped as an image, because it
 * has to sit on a dark ground and stay crisp at every size.
 */
function Wordmark() {
  return (
    <span className="flex items-baseline gap-1.5">
      <svg
        viewBox="0 0 26 20"
        className="h-5 w-6 shrink-0 self-center text-amber"
        aria-hidden="true"
      >
        <path
          d="M2 18L13 2l11 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[21px] font-bold tracking-tight text-white">
        vertex
      </span>
      <span className="hidden text-[11px] font-medium tracking-wide text-white/55 sm:inline">
        infosolutions
      </span>
    </span>
  );
}

export async function Header() {
  const [user, cart, market, categories, brands] = await Promise.all([
    getUser(),
    getCart(),
    getMarket(),
    getCategories(),
    getBrands(),
  ]);
  const count = cart ? totalsFor(cart.items, market).count : 0;
  const locked = (cart?.items.length ?? 0) > 0;

  return (
    <header className="on-dark sticky top-0 z-40">
      <div className="bg-nav text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
          <Link
            href="/"
            className="shrink-0 rounded px-1 py-1 hover:opacity-90"
            aria-label="Vertex Infosolutions — home"
          >
            <Wordmark />
          </Link>

          {/* The market switch. Prices, tax treatment and payment methods all
              follow from it, so it sits beside the wordmark rather than in a
              footer. Locked once the basket holds something — see getMarket —
              so a total cannot change under the customer. */}
          <form
            action={setMarket}
            className="flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 sm:px-2"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4 text-white/70"
              aria-hidden="true"
            >
              <circle
                cx="10"
                cy="10"
                r="7.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M2.8 10h14.4M10 2.8c3.4 3.6 3.4 10.8 0 14.4-3.4-3.6-3.4-10.8 0-14.4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            <span className="leading-tight">
              {/* The caption is the first thing to go on a narrow screen; the
                  value and the globe beside it carry the meaning on their own. */}
              <span className="hidden text-[11px] text-white/60 sm:block">
                {locked ? "Priced in" : "Prices in"}
              </span>
              {locked ? (
                <span className="block text-[13px] font-semibold">
                  {market.currency === "INR"
                    ? "₹ India (INR)"
                    : "$ International (USD)"}
                </span>
              ) : (
                <CurrencySelect
                  id="header-currency"
                  value={market.currency}
                  className="-ml-1 max-w-[7.5rem] bg-transparent text-[13px] font-semibold text-white outline-none sm:max-w-[12rem] [&>option]:text-ink"
                />
              )}
            </span>
          </form>

          {/* Search is the header's centre of gravity, so it takes the whole
              remaining row and drops to its own line on a narrow screen. */}
          <form
            action="/s"
            // `basis-full` rather than `w-full`: a flex item's basis wins over
            // its width, so width alone would leave the field squeezed onto
            // the logo's row on a phone instead of wrapping below it.
            className="search-shell order-last flex h-10 min-w-0 basis-full overflow-hidden rounded-md border border-transparent bg-white sm:order-none sm:flex-1 sm:basis-auto"
          >
            <label htmlFor="site-search" className="sr-only">
              Search the Vertex catalogue
            </label>
            <input
              id="site-search"
              type="search"
              name="q"
              placeholder="Search Microsoft, Adobe, Autodesk…"
              className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-ink outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              className="btn-amber flex shrink-0 items-center justify-center px-4"
              aria-label="Search"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
                <circle
                  cx="9"
                  cy="9"
                  r="6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M13.5 13.5L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </form>

          <Link
            href={user ? "/account" : "/signin"}
            className="hidden shrink-0 rounded px-2 py-1 leading-tight hover:bg-white/10 sm:block"
          >
            <span className="block text-[11px] text-white/60">
              {user ? `Hello, ${user.name.split(" ")[0]}` : "Sign in"}
            </span>
            <span className="block text-[13px] font-semibold">
              {user ? "Keys & orders" : "Your account"}
            </span>
          </Link>

          <Link
            href="/cart"
            className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10"
          >
            <span className="relative">
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                <path
                  d="M3 4h2.2l2.4 11h10.3l2.1-8H6.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9.5" cy="19" r="1.6" fill="currentColor" />
                <circle cx="17" cy="19" r="1.6" fill="currentColor" />
              </svg>
              <span
                className="absolute -top-1 left-4 min-w-[18px] rounded-full bg-amber px-1 text-center text-[11px] font-bold text-ink"
                aria-hidden="true"
              >
                {count}
              </span>
            </span>
            <span className="hidden text-[13px] font-semibold sm:inline">
              Cart
            </span>
            <span className="sr-only">
              {count === 1 ? "1 item in cart" : `${count} items in cart`}
            </span>
          </Link>
        </div>
      </div>

      <nav
        aria-label="Publishers and categories"
        className="bg-nav-2 text-white/90 shadow-sm"
      >
        <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-2 py-1.5 text-[13px] sm:px-3">
          <Link
            href="/s"
            className="shrink-0 rounded px-2.5 py-1 font-semibold hover:bg-white/10"
          >
            All
          </Link>
          {brands.map((brand) => (
            <Link
              key={brand.slug}
              href={`/s?brand=${brand.slug}`}
              className="shrink-0 rounded px-2.5 py-1 font-semibold hover:bg-white/10"
            >
              {brand.name}
            </Link>
          ))}
          <span className="shrink-0 px-1 text-white/25" aria-hidden="true">
            |
          </span>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/s?category=${category.slug}`}
              className="shrink-0 rounded px-2.5 py-1 hover:bg-white/10"
            >
              {category.name}
            </Link>
          ))}
          <span className="ml-auto hidden shrink-0 px-2.5 py-1 text-white/60 lg:block">
            {market.currency === "INR"
              ? "GST invoice on every order"
              : "Keys by email, worldwide"}
          </span>
        </div>
      </nav>
    </header>
  );
}
