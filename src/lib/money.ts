/**
 * Money is integer paise everywhere. A rupee value never exists as a number in
 * this codebase — only as a string on its way to a screen.
 */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,24,900 — whole rupees, the Indian digit grouping, for prices on screen. */
export function formatMoney(minor: number): string {
  return inr.format(Math.round(minor) / 100);
}

/** ₹1,24,900.00 — for invoice lines, where the paise have to be shown. */
export function formatMoneyExact(minor: number): string {
  return inrPaise.format(minor / 100);
}

export function discountPercent(mrpMinor: number, priceMinor: number): number {
  if (mrpMinor <= 0 || priceMinor >= mrpMinor) return 0;
  return Math.round(((mrpMinor - priceMinor) / mrpMinor) * 100);
}

/**
 * GST is charged on the selling price, which for a retail listing is inclusive.
 * Splitting it back out for the invoice is the reverse calculation, and it is
 * done in paise so the parts always add back up to the whole.
 */
export function taxComponent(inclusiveMinor: number, ratePercent: number): number {
  return Math.round(inclusiveMinor - (inclusiveMinor * 100) / (100 + ratePercent));
}
