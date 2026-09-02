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
import { estimateDelivery, isServiceable, isValidPincode } from "@/lib/delivery";
import { methodsFor, type PaymentMethod } from "@/lib/types";

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

/** VX-4F2A-9C31-8BE0 — grouped so it can be read down a phone line. */
function licenceKey(): string {
  const block = () => randomBytes(2).toString("hex").toUpperCase();
  return `VX-${block()}-${block()}-${block()}`;
}

function orderNumber(): string {
  const year = new Date().getFullYear();
  return `VX-${year}-${randomInt(100000, 999999)}`;
}

export type CheckoutError = { message: string; field?: string };

/**
 * Placing the order.
 *
 * This is where the mixed basket resolves. One order and one payment are
 * written, and beneath them one fulfilment per kind: a shipment for anything
 * physical, a digital delivery for anything licensed. Each carries its own
 * status from then on, which is why an order can be delivered by email and
 * still in transit by road without either fact contradicting the other.
 */
export async function placeOrder(
  _previous: CheckoutError | null,
  form: FormData,
): Promise<CheckoutError | null> {
  const cart = await getCart();
  if (!cart || cart.items.length === 0) {
    return { message: "Your cart is empty." };
  }

  const totals = totalsFor(cart.items);

  const email = str(form, "email");
  const phone = str(form, "phone");
  const method = str(form, "paymentMethod") as PaymentMethod;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return {
      message: "Enter an email address we can send the invoice to.",
      field: "email",
    };
  }
  if (!/^[6-9][0-9]{9}$/.test(phone.replace(/\s+/g, ""))) {
    return { message: "Enter a 10-digit Indian mobile number.", field: "phone" };
  }
  if (!methodsFor(totals.hasLicence).includes(method)) {
    return {
      message: totals.hasLicence
        ? "Cash on delivery is not available on orders containing a licence."
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
    state: string;
    pincode: string;
  } | null = null;

  if (totals.hasPhysical) {
    const name = str(form, "shipName");
    const line1 = str(form, "shipLine1");
    const city = str(form, "shipCity");
    const state = str(form, "shipState");
    const pincode = str(form, "shipPincode");

    if (!name || !line1 || !city || !state) {
      return { message: "Fill in the delivery address.", field: "shipLine1" };
    }
    if (!isValidPincode(pincode)) {
      return { message: "Enter a valid 6-digit pincode.", field: "shipPincode" };
    }
    if (!isServiceable(pincode)) {
      return {
        message: `We do not deliver to ${pincode} yet. Remove the shipped items, or call us and we will arrange a courier.`,
        field: "shipPincode",
      };
    }
    ship = {
      name,
      line1,
      line2: str(form, "shipLine2") || null,
      city,
      state,
      pincode,
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
        shipName: ship?.name ?? null,
        shipLine1: ship?.line1 ?? null,
        shipLine2: ship?.line2 ?? null,
        shipCity: ship?.city ?? null,
        shipState: ship?.state ?? null,
        shipPincode: ship?.pincode ?? null,
        itemsMinor: totals.itemsMinor,
        shippingMinor: totals.shippingMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        paymentMethod: method,
        // Cash on delivery is unpaid by definition until the courier collects.
        // Everything else is settled here; a real gateway would leave this
        // PENDING and let the webhook move it.
        paymentStatus: method === "COD" ? "PENDING" : "PAID",
        paidAt: method === "COD" ? null : now,
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
      const fulfilment = await tx.fulfilment.create({
        data: {
          orderId: order.id,
          kind: "SHIPMENT",
          status: "PENDING",
          promisedBy: estimateDelivery(ship?.pincode ?? null, slowest, now),
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
            gstRatePercent: line.variant.gstRatePercent,
            hsnSac: line.variant.product.hsnSac,
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
      const paid = method !== "COD";
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
            gstRatePercent: line.variant.gstRatePercent,
            hsnSac: line.variant.product.hsnSac,
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
