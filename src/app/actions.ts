"use server";

import { randomBytes, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearCartCookie,
  ensureCart,
  getCart,
  maxQtyFor,
  totalsFor,
} from "@/lib/cart";
import { prisma } from "@/lib/db";
import { STORE_CURRENCY } from "@/lib/money";
import {
  countryName,
  estimateArrival,
  isRestricted,
  postcodeLooksValid,
  zoneFor,
} from "@/lib/shipping";
import { methodsFor } from "@/lib/types";
import type { PaymentMethod } from "@/generated/prisma/enums";

/**
 * Every action here re-reads prices, stock and totals from the database. What
 * arrives in a FormData says *what* the customer wants, never *what it costs* —
 * a form that posted its own total would be the whole of the security model,
 * and it would be one line of devtools to defeat.
 */

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function addToCart(form: FormData) {
  const variantId = str(form, "variantId");
  const requested = Number.parseInt(str(form, "qty") || "1", 10);
  const qty = Number.isFinite(requested) ? Math.max(1, requested) : 1;

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    include: { product: { select: { slug: true } } },
  });
  if (!variant) return;

  const cart = await ensureCart();
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
  });

  // The cap is the shelf, not the request. Asking for twelve of something with
  // three left puts three in the basket, and the cart page says why.
  const ceiling = maxQtyFor(variant.stockOnHand);
  const next = Math.min(ceiling, (existing?.qty ?? 0) + qty);
  if (next <= 0) return;

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

  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { variant: { select: { stockOnHand: true } } },
  });
  if (!item) return;

  if (!Number.isFinite(qty) || qty <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    await prisma.cartItem.update({
      where: { id: item.id },
      data: { qty: Math.min(qty, maxQtyFor(item.variant.stockOnHand)) },
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

/**
 * Remember where the basket is going, so carriage can be priced before the
 * customer commits to filling in an address. Shipping to a cross-border
 * destination is a real cost and hiding it until the last screen is the single
 * most common reason a cart is abandoned.
 */
export async function setDestination(form: FormData) {
  const country = str(form, "country").toUpperCase().slice(0, 2);
  const cart = await ensureCart();
  await prisma.cart.update({
    where: { id: cart.id },
    data: { country: country || null },
  });
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
 * This is where the mixed basket resolves. One order and one payment are
 * written, and beneath them one fulfilment per kind: a shipment for anything
 * physical, a digital delivery for anything licensed. Each carries its own
 * status from then on, which is why an order can be delivered by email and
 * still clearing customs without either fact contradicting the other.
 */
export async function placeOrder(
  _previous: CheckoutError | null,
  form: FormData,
): Promise<CheckoutError | null> {
  const cart = await getCart();
  if (!cart || cart.items.length === 0) {
    return { message: "Your cart is empty." };
  }

  const email = str(form, "email");
  const phone = str(form, "phone");
  const method = str(form, "paymentMethod") as PaymentMethod;
  const country = str(form, "shipCountry").toUpperCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return {
      message: "Enter an email address we can send the invoice to.",
      field: "email",
    };
  }
  // Deliberately loose: international numbers vary enormously and a carrier
  // needs something to call, not something that matches one country's format.
  if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(phone)) {
    return {
      message: "Enter a phone number the courier can reach you on, with country code.",
      field: "phone",
    };
  }

  const totals = totalsFor(cart.items, country || null);

  if (!methodsFor(totals.licencesOnly).includes(method)) {
    return {
      message: totals.licencesOnly
        ? "Bank transfer is not offered on licence-only orders, because the keys are issued as soon as payment clears."
        : "Choose a payment method.",
      field: "paymentMethod",
    };
  }

  // An address is required only when something has to physically arrive.
  let ship: {
    name: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postcode: string;
    country: string;
  } | null = null;

  if (totals.hasPhysical) {
    const name = str(form, "shipName");
    const line1 = str(form, "shipLine1");
    const city = str(form, "shipCity");
    const postcode = str(form, "shipPostcode");

    if (!country) {
      return { message: "Choose a destination country.", field: "shipCountry" };
    }
    // Export compliance is checked before anything else about the address:
    // there is no version of this order that becomes acceptable further down
    // the form.
    if (isRestricted(country)) {
      return {
        message: `We cannot ship to ${countryName(country)}. See our export compliance policy.`,
        field: "shipCountry",
      };
    }
    if (!zoneFor(country)) {
      return {
        message: `We do not ship to ${countryName(country)} yet. Email us and we will quote a freight forwarder.`,
        field: "shipCountry",
      };
    }
    if (!name || !line1 || !city) {
      return { message: "Fill in the delivery address.", field: "shipLine1" };
    }
    if (!postcodeLooksValid(postcode, country)) {
      return {
        message: "That postal code does not look right for the country selected.",
        field: "shipPostcode",
      };
    }

    ship = {
      name,
      line1,
      line2: str(form, "shipLine2") || null,
      city,
      region: str(form, "shipRegion") || null,
      postcode,
      country,
    };
  } else if (country && isRestricted(country)) {
    // Software is export-controlled too. A licence key is not exempt because
    // it travels by email.
    return {
      message: `We cannot supply licences to ${countryName(country)}. See our export compliance policy.`,
      field: "shipCountry",
    };
  }

  // Stock is checked immediately before writing, not when the item was added.
  for (const line of cart.items) {
    const stock = line.variant.stockOnHand;
    if (stock !== null && line.qty > stock) {
      return {
        message: `${line.variant.product.name} — only ${stock} left. Reduce the quantity to continue.`,
      };
    }
  }

  const number = orderNumber();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        number,
        email,
        phone,
        currency: STORE_CURRENCY,
        shipName: ship?.name ?? null,
        shipLine1: ship?.line1 ?? null,
        shipLine2: ship?.line2 ?? null,
        shipCity: ship?.city ?? null,
        shipRegion: ship?.region ?? null,
        shipPostcode: ship?.postcode ?? null,
        shipCountry: ship?.country ?? null,
        itemsMinor: totals.itemsMinor,
        shippingMinor: totals.shippingMinor,
        // Nothing is collected at checkout: the store ships DAP and the
        // destination levies its own duty on arrival. The column exists for
        // the day it registers for EU IOSS or UK VAT.
        taxMinor: 0,
        totalMinor: totals.totalMinor,
        paymentMethod: method,
        // A bank transfer is unpaid until the funds land. Card and PayPal are
        // settled here; a real gateway would leave this PENDING and let the
        // webhook move it, with capture idempotent because the browser and the
        // webhook both report success in no guaranteed order.
        paymentStatus: method === "BANK_TRANSFER" ? "PENDING" : "PAID",
        paidAt: method === "BANK_TRANSFER" ? null : now,
      },
    });

    const physical = cart.items.filter(
      (line) => line.variant.product.kind === "PHYSICAL",
    );
    const digital = cart.items.filter(
      (line) => line.variant.product.kind === "LICENCE",
    );

    if (physical.length > 0) {
      const slowest = physical.reduce(
        (days, line) => Math.max(days, line.variant.leadDays ?? 3),
        0,
      );
      const arrival = estimateArrival(ship?.country ?? null, slowest, now);
      const fulfilment = await tx.fulfilment.create({
        data: {
          orderId: order.id,
          kind: "SHIPMENT",
          status: "PENDING",
          promisedFrom: arrival.from,
          promisedBy: arrival.to,
        },
      });

      for (const line of physical) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            fulfilmentId: fulfilment.id,
            variantId: line.variantId,
            sku: line.variant.sku,
            name: line.variant.product.name,
            variantName: line.variant.name,
            kind: "PHYSICAL",
            qty: line.qty,
            unitPriceMinor: line.variant.priceMinor,
            hsCode: line.variant.product.hsCode,
            origin: line.variant.product.origin,
            returnable: true,
          },
        });
        // Committed stock leaves the shelf with the order, not with the
        // dispatch — otherwise the window between the two oversells it.
        await tx.variant.update({
          where: { id: line.variantId },
          data: { stockOnHand: { decrement: line.qty } },
        });
      }
    }

    if (digital.length > 0) {
      const paid = method !== "BANK_TRANSFER";
      const fulfilment = await tx.fulfilment.create({
        data: {
          orderId: order.id,
          kind: "DIGITAL",
          // A key is issued against cleared payment and nothing else.
          status: paid ? "ISSUED" : "PENDING",
          completedAt: paid ? now : null,
        },
      });

      for (const line of digital) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            fulfilmentId: fulfilment.id,
            variantId: line.variantId,
            sku: line.variant.sku,
            name: line.variant.product.name,
            variantName: line.variant.name,
            kind: "LICENCE",
            qty: line.qty,
            unitPriceMinor: line.variant.priceMinor,
            // A licence crosses no border, so it carries no customs data.
            hsCode: null,
            origin: null,
            // A revealed key cannot be put back, so the return window that
            // applies to the shipped half of this same order does not apply
            // here. The order page says so rather than offering a dead button.
            returnable: false,
            licenceKey: paid ? licenceKey() : null,
          },
        });
      }
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.delete({ where: { id: cart.id } });
  });

  await clearCartCookie();
  revalidatePath("/cart");
  redirect(`/order/${number}`);
}
