"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
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
import { fulfilOrder, notifyPending } from "@/lib/orders";
import {
  appUrl,
  getStripe,
  simulatedPayments,
  stripeConfigured,
  toStripeAmount,
} from "@/lib/stripe";
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
      product: { select: { slug: true, published: true, quoteOnly: true } },
    },
  });
  // Three separate reasons to refuse, all of which look like a normal request
  // by the time they reach here: a form left open on a page that has since
  // been withdrawn, a variant not sold in this market, and a licence we do not
  // publish a price for. Adding any of them and showing a blank price is not
  // the honest outcome.
  if (!variant) return;
  if (!variant.product.published) return;
  if (variant.product.quoteOnly) return;
  if (variant.prices.length === 0) return;

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

export type CheckoutError = { message: string; field?: string };

function orderNumber(): string {
  return `VX-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;
}

/**
 * Placing the order.
 *
 * The order row is written first, PENDING, and the money is taken second. That
 * ordering matters: a payment with no order behind it is money taken for
 * nothing, whereas an order with no payment is just an abandoned checkout that
 * expires quietly. So the record always exists before the charge is attempted.
 *
 * What this function has to get right beyond that is the tax treatment, which
 * turns entirely on where the buyer is:
 *
 *   India      → domestic supply of services, GST charged, SAC on the invoice
 *   elsewhere  → export, zero-rated, destination's own taxes not ours to take
 *
 * Fulfilment — issuing the keys — deliberately does not happen here. It happens
 * in `fulfilOrder`, once, when the payment is confirmed. See lib/orders.ts.
 */
export async function placeOrder(
  _previous: CheckoutError | null,
  form: FormData,
): Promise<CheckoutError | null> {
  // Licence keys are delivered into an account, so there has to be one, and it
  // has to be a verified address or the keys go somewhere nobody can read.
  const user = await getUser();
  if (!user) redirect("/signin?next=/checkout");
  if (!user.emailVerifiedAt) redirect("/verify");

  const cart = await getCart();
  if (!cart || cart.items.length === 0) {
    return { message: "Your cart is empty." };
  }

  const market = await getMarket();
  const totals = totalsFor(cart.items, market);

  if (totals.withdrawn > 0) {
    return {
      message:
        "Something in your cart is no longer on sale. Remove it to continue — and ask us if you still want it, because we can usually still supply it.",
    };
  }

  if (totals.unpriced > 0) {
    return {
      message:
        "Something in your cart is not sold in this currency. Remove it, or switch back to the currency you added it in.",
    };
  }

  // An order this large cannot be recorded, so it must not be charged. Saying
  // so here beats a database error after the customer has paid.
  if (totals.overCeiling) {
    return {
      message:
        "This order is too large to place online. Email us and we will quote it and invoice you directly.",
    };
  }

  const phone = str(form, "phone");
  const name = str(form, "billName");
  const country = str(form, "billCountry").toUpperCase();
  const method = str(form, "paymentMethod") as PaymentMethod;
  const gstin = str(form, "gstin").toUpperCase();

  // Deliberately loose: international numbers vary enormously and we need
  // something to call, not something matching one country's format.
  if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(phone)) {
    return { message: "Enter a phone number with country code.", field: "phone" };
  }
  if (!name) {
    return {
      message: "Enter the name the invoice should be made out to.",
      field: "billName",
    };
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
    return { message: "A GSTIN only applies to an Indian order.", field: "gstin" };
  }
  if (gstin && !looksLikeGstin(gstin)) {
    return {
      message: "That does not look like a valid 15-character GSTIN.",
      field: "gstin",
    };
  }

  if (!methodsFor().includes(method)) {
    return { message: "Choose a payment method.", field: "paymentMethod" };
  }

  const number = orderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        number,
        userId: user.id,
        email: user.email,
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
        paymentStatus: "PENDING",
      },
    });

    const fulfilment = await tx.fulfilment.create({
      data: { orderId: created.id, kind: "DIGITAL", status: "PENDING" },
    });

    for (const line of cart.items) {
      const price = line.variant.prices.find(
        (p) => p.currency === totals.currency,
      );
      if (!price) continue;
      await tx.orderItem.create({
        data: {
          orderId: created.id,
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
        },
      });
    }

    return created;
  });

  // A bank transfer is not a payment, it is a promise of one. The order stands,
  // the keys wait, and the customer is told which state they are in.
  if (method === "BANK_TRANSFER") {
    await emptyCart(cart.id);
    await notifyPending(order.id);
    redirect(`/account/orders/${order.number}`);
  }

  if (stripeConfigured()) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Stripe hosts the card form. Nothing sensitive touches this app.
      success_url: `${appUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/cart?cancelled=1`,
      customer_email: user.email,
      client_reference_id: order.id,
      // Read back in the webhook, which may arrive before the browser does.
      metadata: { orderId: order.id, orderNumber: order.number },
      payment_intent_data: {
        metadata: { orderId: order.id, orderNumber: order.number },
      },
      line_items: cart.items.flatMap((line) => {
        const price = line.variant.prices.find(
          (p) => p.currency === totals.currency,
        );
        if (!price) return [];
        return [
          {
            quantity: line.qty,
            price_data: {
              currency: totals.currency.toLowerCase(),
              unit_amount: toStripeAmount(price.priceMinor),
              product_data: {
                name: line.variant.product.name,
                description: line.variant.name,
              },
            },
          },
        ];
      }),
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });
    await emptyCart(cart.id);

    if (!session.url) {
      return {
        message:
          "The payment page could not be opened. Your order is saved — try again from your account.",
      };
    }
    redirect(session.url);
  }

  if (!simulatedPayments()) {
    return {
      message:
        "Card payments are not available right now. Choose bank transfer, or contact us.",
      field: "paymentMethod",
    };
  }

  // Development only — `simulatedPayments` refuses to return true in
  // production, because a live store that marks orders paid without taking
  // money is worse than one that cannot check out at all.
  await emptyCart(cart.id);
  await fulfilOrder(order.id);
  redirect(`/account/orders/${order.number}`);
}

async function emptyCart(cartId: string): Promise<void> {
  await prisma.cartItem.deleteMany({ where: { cartId } });
  await prisma.cart.delete({ where: { id: cartId } });
  await clearCartCookie();
  revalidatePath("/cart");
}

/**
 * Confirm a Stripe Checkout Session when the browser comes back.
 *
 * The webhook is the authority — it arrives whether or not the customer's
 * browser survives the redirect — but waiting for it would leave somebody
 * staring at a page saying "pending" seconds after they paid. So both paths
 * confirm, and `fulfilOrder` makes the second one a no-op.
 *
 * The session is re-fetched from Stripe rather than trusted from the URL: a
 * `session_id` in a query string is attacker-supplied, and the only thing that
 * makes it meaningful is asking Stripe what it actually says.
 */
export async function confirmCheckoutSession(
  sessionId: string,
): Promise<{ orderNumber: string } | { error: string }> {
  if (!stripeConfigured()) return { error: "Payments are not configured." };

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const orderId =
    session.metadata?.orderId ?? (session.client_reference_id || undefined);
  if (!orderId) return { error: "That payment does not match an order." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, number: true },
  });
  if (!order) return { error: "That payment does not match an order." };

  if (session.payment_status !== "paid") {
    return { error: "That payment has not completed." };
  }

  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  await fulfilOrder(order.id, { intentId });
  return { orderNumber: order.number };
}
