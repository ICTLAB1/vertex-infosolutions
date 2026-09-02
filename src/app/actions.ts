"use server";

import { randomBytes, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearCartCookie,
  ensureCart,
  getCart,
  getMarket,
  MAX_QTY,
  setMarketCookie,
  totalsFor,
} from "@/lib/cart";
import { prisma } from "@/lib/db";
import {
  countryName,
  isCurrency,
  isKnownBillingCountry,
  isRestricted,
  looksLikeGstin,
} from "@/lib/market";
import { methodsFor } from "@/lib/types";
import type { PaymentMethod } from "@/generated/prisma/enums";

/**
 * Every action here re-reads prices and totals from the database. What arrives
 * in a FormData says *what* the customer wants, never *what it costs* — a form
 * that posted its own total would be the whole of the security model, and it
 * would be one line of devtools to defeat.
 */

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Switch market. Fixes the currency for everything the visitor sees next.
 *
 * A basket that already has something in it keeps its own currency — see
 * `getMarket` — so this is refused rather than silently ignored while the
 * prices stay put.
 */
export async function setMarket(form: FormData) {
  const value = str(form, "currency").toUpperCase();
  if (!isCurrency(value)) return;

  await setMarketCookie(value);

  const cart = await getCart();
  if (cart && cart.items.length === 0) {
    // An empty basket can be repriced freely; there is nothing to change under
    // the customer.
    await prisma.cart.update({
      where: { id: cart.id },
      data: { currency: value, country: value === "INR" ? "IN" : null },
    });
  }

  revalidatePath("/", "layout");
}

export async function addToCart(form: FormData) {
  const variantId = str(form, "variantId");
  const requested = Number.parseInt(str(form, "qty") || "1", 10);
  const qty = Number.isFinite(requested) ? Math.max(1, requested) : 1;

  const market = await getMarket();

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    include: {
      prices: { where: { currency: market.currency } },
      product: { select: { slug: true } },
    },
  });
  // A variant with no price in this market is not sold here. Refusing the add
  // is the honest outcome; adding it and showing a blank price is not.
  if (!variant || variant.prices.length === 0) return;

  const cart = await ensureCart(market.currency, market.country);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
  });

  const next = Math.min(MAX_QTY, (existing?.qty ?? 0) + qty);

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    create: { cartId: cart.id, variantId: variant.id, qty: next },
    update: { qty: next },
  });

  revalidatePath("/cart");
  revalidatePath(`/product/${variant.product.slug}`);
}

export async function buyNow(form: FormData) {
  await addToCart(form);
  redirect("/checkout");
}

export async function setQty(form: FormData) {
  const itemId = str(form, "itemId");
  const qty = Number.parseInt(str(form, "qty") || "0", 10);

  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  if (!Number.isFinite(qty) || qty <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    await prisma.cartItem.update({
      where: { id: item.id },
      data: { qty: Math.min(qty, MAX_QTY) },
    });
  }

  revalidatePath("/cart");
  revalidatePath("/checkout");
}

export async function removeFromCart(form: FormData) {
  const itemId = str(form, "itemId");
  await prisma.cartItem.deleteMany({ where: { id: itemId } });
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

/** VX-4F2A-9C31-8BE0 — grouped so it can be read aloud on a support call. */
function licenceKey(): string {
  const block = () => randomBytes(2).toString("hex").toUpperCase();
  return `VX-${block()}-${block()}-${block()}`;
}

function orderNumber(): string {
  return `VX-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;
}

export type CheckoutError = { message: string; field?: string };

/**
 * Placing the order.
 *
 * Nothing is shipped, so there is no address and no fulfilment split to
 * resolve: one order, one digital fulfilment, keys issued the moment payment
 * clears. What this function does have to get right is the tax treatment, which
 * turns entirely on where the buyer is:
 *
 *   India      → domestic supply of services, GST charged, SAC on the invoice
 *   elsewhere  → export, zero-rated, destination's own taxes not ours to take
 *
 * The billing country decides that, and it is checked against the currency the
 * basket was priced in — an INR basket billed to Germany means somebody has
 * changed one of the two, and the order is refused rather than taxed wrongly.
 */
export async function placeOrder(
  _previous: CheckoutError | null,
  form: FormData,
): Promise<CheckoutError | null> {
  const cart = await getCart();
  if (!cart || cart.items.length === 0) {
    return { message: "Your cart is empty." };
  }

  const market = await getMarket();
  const totals = totalsFor(cart.items, market);

  if (totals.unpriced > 0) {
    return {
      message:
        "Something in your cart is not sold in this currency. Remove it, or switch back to the currency you added it in.",
    };
  }

  const email = str(form, "email");
  const phone = str(form, "phone");
  const name = str(form, "billName");
  const country = str(form, "billCountry").toUpperCase();
  const method = str(form, "paymentMethod") as PaymentMethod;
  const gstin = str(form, "gstin").toUpperCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return {
      message: "Enter an email address. The licence keys are sent there.",
      field: "email",
    };
  }
  // Deliberately loose: international numbers vary enormously and we need
  // something to call, not something matching one country's format.
  if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(phone)) {
    return {
      message: "Enter a phone number with country code.",
      field: "phone",
    };
  }
  if (!name) {
    return { message: "Enter the name the invoice should be made out to.", field: "billName" };
  }
  if (!country) {
    return { message: "Choose your billing country.", field: "billCountry" };
  }
  // Export control is checked before anything else about the country, and
  // before the known-billing-country test — restricted countries are
  // deliberately absent from that list, so checking membership first would
  // refuse them with "choose your billing country" and lose the reason.
  if (isRestricted(country)) {
    return {
      message: `We cannot supply licences to ${countryName(country)}. See our export compliance policy.`,
      field: "billCountry",
    };
  }
  if (!isKnownBillingCountry(country)) {
    return {
      message: `We cannot invoice to ${countryName(country)} yet. Email us and we will arrange it.`,
      field: "billCountry",
    };
  }

  // The currency and the country have to agree. They are set by different
  // mechanisms — one by the basket, one by this form — and a mismatch means
  // GST would be charged on an export or omitted on a domestic sale.
  const domestic = country === "IN";
  if (domestic && market.currency !== "INR") {
    return {
      message:
        "An Indian billing address is priced in INR. Switch the currency to ₹ INR and your cart will be repriced.",
      field: "billCountry",
    };
  }
  if (!domestic && market.currency === "INR") {
    return {
      message:
        "INR pricing is for customers billing in India. Switch the currency to $ USD to bill this order elsewhere.",
      field: "billCountry",
    };
  }

  if (gstin && !domestic) {
    return {
      message: "A GSTIN only applies to an Indian order.",
      field: "gstin",
    };
  }
  if (gstin && !looksLikeGstin(gstin)) {
    return { message: "That does not look like a valid 15-character GSTIN.", field: "gstin" };
  }

  if (!methodsFor(market.currency).includes(method)) {
    return { message: "Choose a payment method.", field: "paymentMethod" };
  }

  const number = orderNumber();
  const now = new Date();
  // A bank transfer is unpaid until the funds land; everything else is settled
  // here. A real gateway would leave this PENDING and let the webhook move it,
  // with capture idempotent because the browser and the webhook both report
  // success in no guaranteed order.
  const settled = method !== "BANK_TRANSFER";

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        number,
        email,
        phone,
        currency: totals.currency,
        country,
        billName: name,
        billCompany: str(form, "billCompany") || null,
        billCity: str(form, "billCity") || null,
        billRegion: str(form, "billRegion") || null,
        billPostcode: str(form, "billPostcode") || null,
        gstin: gstin || null,
        netMinor: totals.netMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        taxRatePercent: totals.taxRatePercent,
        taxLabel: totals.taxLabel,
        paymentMethod: method,
        paymentStatus: settled ? "PAID" : "PENDING",
        paidAt: settled ? now : null,
      },
    });

    const fulfilment = await tx.fulfilment.create({
      data: {
        orderId: order.id,
        kind: "DIGITAL",
        // A key is issued against cleared payment and nothing else.
        status: settled ? "ISSUED" : "PENDING",
        completedAt: settled ? now : null,
      },
    });

    for (const line of cart.items) {
      const price = line.variant.prices.find(
        (p) => p.currency === totals.currency,
      );
      if (!price) continue;

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          fulfilmentId: fulfilment.id,
          variantId: line.variantId,
          sku: line.variant.sku,
          name: line.variant.product.name,
          variantName: line.variant.name,
          seats: line.variant.seats,
          qty: line.qty,
          unitPriceMinor: price.priceMinor,
          // Only meaningful on a domestic invoice, but stored on every line so
          // an order is readable without knowing which rules applied.
          sacCode: line.variant.product.sacCode,
          licenceKey: settled ? licenceKey() : null,
        },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.delete({ where: { id: cart.id } });
  });

  await clearCartCookie();
  revalidatePath("/cart");
  redirect(`/order/${number}`);
}
