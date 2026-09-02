import "server-only";

import Stripe from "stripe";

/**
 * Stripe.
 *
 * The store never sees a card number. Checkout Sessions are created here, the
 * customer is redirected to Stripe's own hosted page, and the money is
 * confirmed by a signed webhook. There is no card field anywhere in this
 * repository and that is the entire security design: what you do not hold, you
 * cannot leak.
 *
 * The API version is the one this SDK was generated against. Pinning it
 * explicitly means a future `npm update` cannot silently change the shape of a
 * webhook payload this code parses.
 */
export const STRIPE_API_VERSION = "2026-08-26.dahlia";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Checkout runs in simulated mode until it is.",
    );
  }
  if (!client) {
    client = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      // Retries make a transient network blip invisible rather than a failed
      // payment the customer has to attempt again.
      maxNetworkRetries: 2,
      appInfo: { name: "Vertex Infosolutions storefront" },
    });
  }
  return client;
}

/**
 * Whether the store may take real money.
 *
 * With no key configured, checkout falls back to a simulated payment so the
 * whole flow — order, keys, notifications, account — is exercisable in
 * development. That fallback is refused in production: a live store that
 * silently marks orders paid without taking money is far worse than one that
 * refuses to check out.
 */
export function simulatedPayments(): boolean {
  return !stripeConfigured() && process.env.NODE_ENV !== "production";
}

/** Stripe wants the smallest currency unit, which is what we already store. */
export function toStripeAmount(minor: number): number {
  return Math.round(minor);
}

/**
 * The base URL Stripe returns the customer to.
 *
 * Must be absolute and must match the deployed host, so it is configuration
 * rather than something derived from a request header — a Host header is
 * attacker-controlled, and using one here would let somebody redirect a
 * successful payment to their own site.
 */
export function appUrl(): string {
  const url = process.env.APP_URL ?? "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
