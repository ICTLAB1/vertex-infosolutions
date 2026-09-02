/**
 * Presentation-level facts about the enums the database defines.
 *
 * The enums themselves now live in the Prisma schema and are imported from the
 * generated client, so this file holds only what a screen needs: the words a
 * customer reads, and the rules about which options are offered.
 */
import type { PaymentMethod } from "@/generated/prisma/enums";

/** How a fulfilment's status reads to a customer. */
export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Preparing",
  PACKED: "Packed",
  SHIPPED: "In transit",
  IN_CUSTOMS: "Clearing customs",
  DELIVERED: "Delivered",
  ISSUED: "Issued",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: "Credit or debit card",
  PAYPAL: "PayPal",
  BANK_TRANSFER: "Bank transfer",
};

export const PAYMENT_METHOD_NOTES: Record<PaymentMethod, string> = {
  CARD:
    "You are taken to the payment provider's own page. Vertex never sees your card number.",
  PAYPAL: "Pay with a PayPal balance, a linked bank account or a card.",
  BANK_TRANSFER:
    "We email an invoice with our bank details. The order ships once the funds clear, usually two to four business days.",
};

/**
 * Which methods are offered. A bank transfer takes days to clear, so it is
 * withheld from a basket whose whole point is that the keys arrive in seconds —
 * offering it there would sell a promise the payment method cannot keep.
 */
export function methodsFor(licencesOnly: boolean): readonly PaymentMethod[] {
  return licencesOnly
    ? (["CARD", "PAYPAL"] as const)
    : (["CARD", "PAYPAL", "BANK_TRANSFER"] as const);
}
