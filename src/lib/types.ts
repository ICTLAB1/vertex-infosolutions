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
  CARD: "Credit or debit card",
  PAYPAL: "PayPal",
  UPI: "UPI",
  NETBANKING: "Net banking",
  BANK_TRANSFER: "Bank transfer",
};

export const PAYMENT_METHOD_NOTES: Record<PaymentMethod, string> = {
  CARD:
    "You are taken to the payment provider's own page. Vertex never sees your card number.",
  PAYPAL: "Pay with a PayPal balance, a linked bank account or a card.",
  UPI: "Pay from any UPI app. Keys are issued as soon as the payment confirms.",
  NETBANKING: "Pay directly from an Indian bank account.",
  BANK_TRANSFER:
    "We email an invoice with our bank details. Keys are issued once the funds clear, usually two to four business days.",
};

/**
 * Which methods are offered, which depends entirely on the market.
 *
 * UPI and net banking are domestic Indian rails and cannot settle a foreign
 * card; PayPal is how most of the rest of the world expects to pay a supplier
 * it has not met. Offering a method that cannot complete is worse than not
 * offering it — the customer only finds out at the last step.
 */
export function methodsFor(currency: CurrencyCode): readonly PaymentMethod[] {
  return currency === "INR"
    ? (["UPI", "CARD", "NETBANKING", "BANK_TRANSFER"] as const)
    : (["CARD", "PAYPAL", "BANK_TRANSFER"] as const);
}
