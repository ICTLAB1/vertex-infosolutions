/**
 * Money.
 *
 * Every amount is an integer in the minor unit of its own currency — paise for
 * INR, cents for USD. A price never exists as a floating-point number, because
 * 0.1 + 0.2 is not 0.3 and a storefront is the wrong place to discover that.
 *
 * Every function here takes the currency explicitly. There is no ambient
 * "current currency", because the same process serves an Indian visitor and an
 * American one in adjacent requests, and a module-level default is exactly how
 * one of them ends up seeing the other's prices.
 */
import type { CurrencyCode } from "@/lib/market";

/**
 * Indian digit grouping is not the Western one: ₹12,34,567, not ₹1,234,567.
 * `en-IN` gets that right and `en-US` does not, so the locale follows the
 * currency rather than the reader.
 */
const LOCALES: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
};

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: CurrencyCode, exact: boolean): Intl.NumberFormat {
  const key = `${currency}:${exact}`;
  const existing = formatters.get(key);
  if (existing) return existing;

  const made = new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency,
    // Shelf prices drop the minor unit when there is none to show; an invoice
    // always shows it, because a total reading $1,299 next to lines summing to
    // $1,298.99 looks like an error even when it is rounding.
    minimumFractionDigits: exact ? 2 : 0,
    maximumFractionDigits: 2,
  });
  formatters.set(key, made);
  return made;
}

/** ₹9,200 or $150 — for prices on screen. */
export function formatMoney(minor: number, currency: CurrencyCode): string {
  return formatter(currency, false).format(Math.round(minor) / 100);
}

/** ₹9,200.00 or $150.00 — for invoice lines, where the minor unit is shown. */
export function formatMoneyExact(
  minor: number,
  currency: CurrencyCode,
): string {
  return formatter(currency, true).format(minor / 100);
}

export function discountPercent(listMinor: number, priceMinor: number): number {
  if (listMinor <= 0 || priceMinor >= listMinor) return 0;
  return Math.round(((listMinor - priceMinor) / listMinor) * 100);
}

/**
 * Split a GST-inclusive amount into net and tax.
 *
 * An Indian consumer price includes GST by law and by expectation, so the
 * displayed figure is the whole of what is paid and the tax is extracted from
 * it rather than added to it. Done in paise, and the net is derived by
 * subtraction, so the two parts always add back to exactly the total — which a
 * separately-rounded net and tax would not.
 */
export function splitInclusiveTax(
  totalMinor: number,
  ratePercent: number,
): { netMinor: number; taxMinor: number } {
  if (ratePercent <= 0) return { netMinor: totalMinor, taxMinor: 0 };
  const netMinor = Math.round((totalMinor * 100) / (100 + ratePercent));
  return { netMinor, taxMinor: totalMinor - netMinor };
}


/**
 * Read a typed price into minor units.
 *
 * "9200", "9,200", "9200.50", "₹9,200.50" all mean the same thing to somebody
 * entering a price book, and none of them should become a float on the way in:
 * `9200.29 * 100` is 920028.99999 and rounds to the wrong paisa often enough
 * to matter across a catalogue. The two halves are parsed as separate integers
 * instead.
 *
 * Returns null for anything that is not a plain positive amount, so the caller
 * can refuse it rather than store a zero.
 */
export function parseMoneyMinor(input: string): number | null {
  // Only the separators people actually type are removed. Stripping everything
  // that is not a digit would turn "-500" into 500 and "1e5" into 15 — a price
  // field that quietly accepts a number nobody typed is worse than one that
  // refuses.
  const cleaned = input.trim().replace(/[\s,]/g, "").replace(/^[₹$€£]/, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}
