/**
 * Presentation-level facts about the enums the database defines.
 *
 * The enums themselves live in the Prisma schema and are imported from the
 * generated client, so this file holds only what a screen needs: the words a
 * customer reads, and the rules about which options are offered.
 */
import type { CurrencyCode } from "@/lib/market";
import type { PaymentMethod } from "@/generated/prisma/enums";

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting payment",
  ISSUED: "Delivered",
  CANCELLED: "Cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: "Pay online",
  PAYPAL: "PayPal",
  UPI: "UPI",
  NETBANKING: "Net banking",
  BANK_TRANSFER: "Bank transfer",
};

export function paymentMethodNote(
  method: PaymentMethod,
  currency: CurrencyCode,
): string {
  switch (method) {
    case "CARD":
      // Which rails actually appear is decided by Stripe from the account's
      // settings and the buyer's country — cards everywhere, UPI and net
      // banking for an Indian account taking INR. Listing them here as
      // separate choices would promise something this app does not control.
      return currency === "INR"
        ? "Card, UPI, net banking or wallet, on Stripe's own secure page. Vertex never sees your card or UPI details."
        : "Card or wallet, on Stripe's own secure page. Vertex never sees your card details.";
    case "BANK_TRANSFER":
      return "We email an invoice with our bank details. Your licence is issued once the funds clear, usually two to four business days.";
    default:
      return "";
  }
}

/**
 * Which methods are offered.
 *
 * Two, deliberately. Everything card-shaped goes through Stripe Checkout, which
 * presents the right local methods itself; enumerating UPI and net banking as
 * separate buttons here would be this app guessing at a configuration that
 * lives in the Stripe dashboard, and guessing wrong means a customer picks a
 * method that then is not offered.
 */
export function methodsFor(): readonly PaymentMethod[] {
  return ["CARD", "BANK_TRANSFER"] as const;
}
