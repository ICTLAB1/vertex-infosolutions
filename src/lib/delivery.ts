/**
 * Delivery promises.
 *
 * A date shown next to a price is a promise, and the fastest way to lose a
 * customer's trust is to make one that was never achievable. So the estimate
 * here is deliberately conservative: it counts working days only, and a
 * pincode outside the serviceable set is told so before checkout rather than
 * after payment.
 */

/**
 * Serviceable pincode prefixes. A real deployment reads this from the courier's
 * API; holding it as data keeps the rule in one place either way.
 */
const SERVICEABLE_PREFIXES = [
  "11", "12", "13", // Delhi NCR
  "20", "21", "22", // Western UP
  "30", "302", "31", // Rajasthan
  "38", "39", // Gujarat
  "40", "41", "42", "43", // Maharashtra
  "50", "51", // Telangana, Andhra
  "56", "57", "58", "59", // Karnataka
  "60", "61", "62", "63", // Tamil Nadu
  "68", "69", // Kerala
  "70", "71", "72", // West Bengal
  "80", "81", // Bihar
];

/** Metro prefixes reach the customer a day sooner. */
const FAST_PREFIXES = ["11", "40", "56", "60", "50", "70"];

export function isValidPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode.trim());
}

export function isServiceable(pincode: string): boolean {
  const clean = pincode.trim();
  if (!isValidPincode(clean)) return false;
  return SERVICEABLE_PREFIXES.some((prefix) => clean.startsWith(prefix));
}

function addWorkingDays(from: Date, days: number): Date {
  const date = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0) remaining -= 1; // couriers run six days a week
  }
  return date;
}

/**
 * When a shipped item should arrive. `leadDays` is the supplier's own lead
 * time; the rest is transit, which depends on how far the parcel has to go.
 */
export function estimateDelivery(
  pincode: string | null,
  leadDays: number,
  now: Date = new Date(),
): Date {
  const clean = (pincode ?? "").trim();
  const fast = FAST_PREFIXES.some((prefix) => clean.startsWith(prefix));
  const transit = clean === "" ? 4 : fast ? 2 : 4;
  return addWorkingDays(now, leadDays + transit);
}

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function formatDeliveryDate(date: Date): string {
  return dayFormat.format(date);
}

/**
 * Free delivery above this, a flat fee below it. Charged on the shipped part of
 * a basket only — a licence has nothing to deliver, and charging freight on a
 * download is the kind of detail that makes a checkout feel dishonest.
 */
export const FREE_SHIPPING_THRESHOLD_MINOR = 50_000_00;
export const FLAT_SHIPPING_MINOR = 79_00;

export function shippingFor(physicalSubtotalMinor: number): number {
  if (physicalSubtotalMinor <= 0) return 0;
  return physicalSubtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR
    ? 0
    : FLAT_SHIPPING_MINOR;
}
