import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/db";
import { fulfilOrder } from "@/lib/orders";
import { getStripe, stripeConfigured } from "@/lib/stripe";

/**
 * Stripe's webhook.
 *
 * This is the authority on whether an order was paid. The browser returning
 * from Checkout is a convenience — it may never happen, because people close
 * tabs — but this request arrives regardless, and Stripe retries it for days if
 * it does not get a 2xx.
 *
 * Three rules, and all three matter:
 *
 * **The signature is verified against the raw body.** Anything else parsed
 * first, then re-serialised, produces different bytes and a signature that
 * never matches. Without verification this endpoint is an unauthenticated
 * "mark my order paid" button.
 *
 * **Fulfilment is idempotent.** Stripe delivers at least once, sometimes more,
 * and the browser confirms in parallel. `fulfilOrder` claims the order with a
 * conditional update, so the second caller does nothing.
 *
 * **A 2xx is returned unless we genuinely failed.** Returning an error for an
 * event we do not care about makes Stripe retry it forever.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured" },
      { status: 503 },
    );
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  // The raw body, exactly as sent. `request.json()` here would break the
  // signature check permanently and subtly.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      payload,
      signature,
      secret,
    );
  } catch (error) {
    // Never log the payload: it can carry customer details, and a webhook that
    // failed verification is not something to trust into a log either.
    console.warn(`[stripe] signature verification failed: ${String(error)}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        // `completed` fires for a session that finished, which for a delayed
        // payment method is not the same as paid. Only `paid` issues keys.
        if (session.payment_status !== "paid") break;

        const orderId =
          session.metadata?.orderId ?? session.client_reference_id ?? null;
        if (!orderId) {
          console.warn(`[stripe] session ${session.id} carries no orderId`);
          break;
        }

        const intentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);

        await fulfilOrder(orderId, { intentId });
        break;
      }

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId =
          session.metadata?.orderId ?? session.client_reference_id ?? null;
        if (!orderId) break;
        // Only ever moves an order that is still waiting. An order already
        // paid — by a retry that succeeded — must not be walked backwards by a
        // late failure event for an earlier attempt.
        await prisma.order.updateMany({
          where: { id: orderId, paymentStatus: "PENDING" },
          data: { paymentStatus: "FAILED" },
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const intentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : (charge.payment_intent?.id ?? null);
        if (!intentId) break;
        await prisma.order.updateMany({
          where: { stripePaymentIntentId: intentId, paymentStatus: "PAID" },
          data: { paymentStatus: "REFUNDED" },
        });
        break;
      }

      default:
        // Everything else is acknowledged and ignored. Stripe sends a great
        // many event types and retrying the ones we do not handle is waste.
        break;
    }
  } catch (error) {
    // A 500 asks Stripe to retry, which is right: the payment happened, and
    // our failure to record it is temporary.
    console.error(`[stripe] handling ${event.type} failed:`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
