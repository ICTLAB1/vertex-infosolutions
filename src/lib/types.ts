/**
 * SQLite has no enums, so the values that would have been enum members live
 * here — one place, checked by the compiler, rather than string literals
 * scattered through queries.
 */

export const PRODUCT_KINDS = ["PHYSICAL", "LICENCE"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const FULFILMENT_KINDS = ["SHIPMENT", "DIGITAL"] as const;
export type FulfilmentKind = (typeof FULFILMENT_KINDS)[number];

export const SHIPMENT_STATUSES = [
  "PENDING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
] as const;
export const DIGITAL_STATUSES = ["PENDING", "ISSUED"] as const;
export type FulfilmentStatus =
  | (typeof SHIPMENT_STATUSES)[number]
  | (typeof DIGITAL_STATUSES)[number];

export const PAYMENT_METHODS = ["UPI", "CARD", "NETBANKING", "COD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** How a fulfilment's status reads to a customer. */
export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Preparing",
  PACKED: "Packed",
  SHIPPED: "In transit",
  DELIVERED: "Delivered",
  // The section heading already says these arrive by email; the badge says
  // whether they have.
  ISSUED: "Issued",
};

/**
 * Cash on delivery cannot apply to a licence — there is nothing for a courier
 * to hand over and nothing to collect against. A basket containing one is
 * offered the other three methods only.
 */
export function methodsFor(hasLicence: boolean): readonly PaymentMethod[] {
  return hasLicence
    ? (["UPI", "CARD", "NETBANKING"] as const)
    : PAYMENT_METHODS;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  UPI: "UPI",
  CARD: "Credit or debit card",
  NETBANKING: "Net banking",
  COD: "Cash on delivery",
};
