import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { quote } from "@/lib/shipping";

const CART_COOKIE = "vx_cart";
const CART_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * The cookie holds an opaque token and nothing else — no prices, no quantities,
 * no user. Everything that decides what is owed lives in the database, so a
 * tampered cookie can at worst point at somebody else's cart id, and the token
 * is 24 random bytes precisely so it cannot be guessed.
 */
function newToken(): string {
  return randomBytes(24).toString("base64url");
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
              hsCode: true,
              origin: true,
              brand: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  },
} as const;

export type Cart = NonNullable<Awaited<ReturnType<typeof getCart>>>;
export type CartLine = Cart["items"][number];

/** The current cart, or null when this browser has never added anything. */
export async function getCart() {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  return prisma.cart.findUnique({ where: { token }, include: cartInclude });
}

/**
 * The current cart, created if needed. Only call this from a Server Action or
 * Route Handler — setting a cookie during a render is not allowed.
 */
export async function ensureCart() {
  const jar = await cookies();
  const existing = jar.get(CART_COOKIE)?.value;
  if (existing) {
    const cart = await prisma.cart.findUnique({ where: { token: existing } });
    if (cart) return cart;
  }

  const token = newToken();
  const cart = await prisma.cart.create({ data: { token } });
  jar.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_MAX_AGE,
  });
  return cart;
}

export async function clearCartCookie() {
  (await cookies()).delete(CART_COOKIE);
}

export type CartTotals = {
  /** What the goods cost, before carriage and before any duty on arrival. */
  itemsMinor: number;
  /** The shipped subset only — what carriage is charged against. */
  physicalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  count: number;
  hasPhysical: boolean;
  hasLicence: boolean;
  /** True when nothing in the basket has to cross a border. */
  licencesOnly: boolean;
  /** Heaviest-case shipped weight, for the carrier and the customs form. */
  weightGrams: number;
  /**
   * Null until a destination is known. Shipping cannot be priced without one,
   * so the cart shows carriage as "calculated at checkout" rather than
   * inventing a number and revising it later.
   */
  shipping:
    | { known: false }
    | { known: true; country: string; free: boolean; zoneLabel: string }
    | { known: true; country: string; blocked: "restricted" | "unsupported" };
};

/**
 * One place computes what is owed, and the cart, the checkout and the order
 * that gets written all read from it. Prices come from the variant rows every
 * time — never from the client, and never from a figure cached when the item
 * was added, so a price change between adding and paying is caught here.
 */
export function totalsFor(
  lines: CartLine[],
  countryCode: string | null,
): CartTotals {
  let itemsMinor = 0;
  let physicalMinor = 0;
  let weightGrams = 0;
  let count = 0;
  let hasPhysical = false;
  let hasLicence = false;

  for (const line of lines) {
    const lineMinor = line.variant.priceMinor * line.qty;
    itemsMinor += lineMinor;
    count += line.qty;

    if (line.variant.product.kind === "PHYSICAL") {
      physicalMinor += lineMinor;
      weightGrams += (line.variant.weightGrams ?? 0) * line.qty;
      hasPhysical = true;
    } else {
      hasLicence = true;
    }
  }

  const licencesOnly = hasLicence && !hasPhysical;

  // A basket of licences alone never needs a destination: nothing ships, so
  // carriage is zero wherever the buyer happens to be.
  if (licencesOnly) {
    return {
      itemsMinor,
      physicalMinor: 0,
      shippingMinor: 0,
      totalMinor: itemsMinor,
      count,
      hasPhysical,
      hasLicence,
      licencesOnly,
      weightGrams: 0,
      shipping: { known: false },
    };
  }

  if (!countryCode) {
    return {
      itemsMinor,
      physicalMinor,
      shippingMinor: 0,
      totalMinor: itemsMinor,
      count,
      hasPhysical,
      hasLicence,
      licencesOnly,
      weightGrams,
      shipping: { known: false },
    };
  }

  const quoted = quote(countryCode, physicalMinor);
  if (!quoted.ok) {
    return {
      itemsMinor,
      physicalMinor,
      shippingMinor: 0,
      totalMinor: itemsMinor,
      count,
      hasPhysical,
      hasLicence,
      licencesOnly,
      weightGrams,
      shipping: { known: true, country: countryCode, blocked: quoted.reason },
    };
  }

  return {
    itemsMinor,
    physicalMinor,
    shippingMinor: quoted.shippingMinor,
    totalMinor: itemsMinor + quoted.shippingMinor,
    count,
    hasPhysical,
    hasLicence,
    licencesOnly,
    weightGrams,
    shipping: {
      known: true,
      country: countryCode,
      free: quoted.free,
      zoneLabel: quoted.zone.label,
    },
  };
}

/**
 * What can actually be added, given what is on the shelf. A licence has no
 * ceiling; anything shipped is capped at the stock on hand, and at ten per
 * order besides — a retail basket asking for forty of one SKU is a trade order
 * and belongs on a quotation, not a card payment.
 */
export function maxQtyFor(stockOnHand: number | null): number {
  if (stockOnHand === null) return 10;
  return Math.max(0, Math.min(10, stockOnHand));
}
