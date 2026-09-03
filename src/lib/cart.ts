import "server-only";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/db";
import {
  isCurrency,
  resolveMarket,
  type CurrencyCode,
  type Market,
} from "@/lib/market";
import { splitInclusiveTax } from "@/lib/money";

const CART_COOKIE = "vx_cart";
const MARKET_COOKIE = "vx_market";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/**
 * The cart cookie holds an opaque token and nothing else — no prices, no
 * quantities, no user. Everything that decides what is owed lives in the
 * database, so a tampered cookie can at worst point at somebody else's cart id,
 * and the token is 24 random bytes precisely so it cannot be guessed.
 */
function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * The market for this request: an explicit choice if one has been made,
 * otherwise whatever the edge and the browser imply.
 *
 * An existing basket overrides both. Prices are fixed when the first item goes
 * in, because a total that changes between the cart and the payment page —
 * because a geo lookup flapped, or the visitor crossed a border — is the kind
 * of thing that ends a sale.
 */
export async function getMarket(): Promise<Market> {
  const [jar, head] = await Promise.all([cookies(), headers()]);
  const chosen = jar.get(MARKET_COOKIE)?.value ?? null;
  const resolved = resolveMarket(head, chosen);

  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return resolved;

  const cart = await prisma.cart.findUnique({
    where: { token },
    select: { currency: true, country: true, items: { select: { id: true } } },
  });
  if (!cart || cart.items.length === 0) return resolved;
  if (!isCurrency(cart.currency)) return resolved;

  return {
    currency: cart.currency,
    country: cart.country ?? resolved.country,
    domestic: cart.currency === "INR",
    source: resolved.source,
  };
}

export const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          product: {
            select: {
              slug: true,
              name: true,
              kind: true,
              glyph: true,
              sacCode: true,
              gstRatePercent: true,
              term: true,
              brand: { select: { name: true } },
            },
          },
          prices: true,
        },
      },
    },
    orderBy: { id: "asc" },
  },
} as const;

export type Cart = NonNullable<Awaited<ReturnType<typeof getCart>>>;
export type CartLine = Cart["items"][number];

export async function getCart() {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  return prisma.cart.findUnique({ where: { token }, include: cartInclude });
}

/**
 * The current cart, created if needed. Only call this from a Server Action or
 * Route Handler — setting a cookie during a render is not allowed.
 */
export async function ensureCart(currency: CurrencyCode, country: string | null) {
  const jar = await cookies();
  const existing = jar.get(CART_COOKIE)?.value;
  if (existing) {
    const cart = await prisma.cart.findUnique({ where: { token: existing } });
    if (cart) return cart;
  }

  const token = newToken();
  const cart = await prisma.cart.create({
    data: { token, currency, country },
  });
  jar.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return cart;
}

/**
 * Remember an explicit market choice. Not HTTP-only: nothing sensitive is in
 * it, and a currency the page's own script can read is one fewer round trip.
 */
export async function setMarketCookie(currency: CurrencyCode) {
  (await cookies()).set(MARKET_COOKIE, currency, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearCartCookie() {
  (await cookies()).delete(CART_COOKIE);
}

export type CartTotals = {
  currency: CurrencyCode;
  /** The sum of the lines as displayed. GST-inclusive on an INR basket. */
  totalMinor: number;
  /** The taxable value beneath that total. */
  netMinor: number;
  /** GST on a domestic Indian sale; zero on an export. */
  taxMinor: number;
  taxRatePercent: number;
  taxLabel: string | null;
  count: number;
  /** Lines whose variant has no price in this currency — never purchasable. */
  unpriced: number;
};

/**
 * One place computes what is owed, and the cart, the checkout and the order all
 * read from it. Prices come from the `Price` rows every time — never from the
 * client, and never from a figure cached when the item was added, so a price
 * change between adding and paying is caught here.
 */
export function totalsFor(lines: CartLine[], market: Market): CartTotals {
  const currency = market.currency;
  let totalMinor = 0;
  let count = 0;
  let unpriced = 0;
  // Every product the store sells is taxed at the same rate, but the rate is
  // read from the products rather than assumed, so a zero-rated line would be
  // handled correctly the day one exists.
  let weightedRate = 0;

  for (const line of lines) {
    const price = line.variant.prices.find((p) => p.currency === currency);
    if (!price) {
      unpriced += 1;
      continue;
    }
    const lineMinor = price.priceMinor * line.qty;
    totalMinor += lineMinor;
    count += line.qty;
    weightedRate = Math.max(weightedRate, line.variant.product.gstRatePercent);
  }

  // GST applies to a domestic Indian supply and to nothing else. An export is
  // zero-rated, and whatever the destination charges is not ours to collect.
  const rate = market.domestic ? weightedRate : 0;
  const { netMinor, taxMinor } = splitInclusiveTax(totalMinor, rate);

  return {
    currency,
    totalMinor,
    netMinor,
    taxMinor,
    taxRatePercent: rate,
    taxLabel: market.domestic ? "GST" : null,
    count,
    unpriced,
  };
}

/**
 * A ceiling rather than a shelf: nothing here is stock, so the only reason to
 * cap a line at all is to keep a typo from becoming an order. Licences sell in
 * seat counts — fifty of a Microsoft 365 SKU is an ordinary purchase, not an
 * exception — so the cap sits far above any real order and the volume-quote
 * offer stays as an invitation rather than a gate.
 */
export const MAX_QTY = 999;
