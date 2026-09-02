/**
 * Money.
 *
 * Every amount in this codebase is an integer in the minor unit of the store's
 * selling currency — cents, while that currency is USD. A price never exists
 * as a floating-point number, because 0.1 + 0.2 is not 0.3 and a storefront is
 * the wrong place to discover that.
 *
 * The currency is configuration rather than a constant. The store sells in USD
 * today; when it sells in more than one, the formatting below already takes the
 * currency as an argument and only the price *storage* has to change.
 */

/** ISO 4217 code the store prices in. */
export const STORE_CURRENCY = (process.env.STORE_CURRENCY ?? "USD").toUpperCase();

/**
 * Minor units per major unit. Almost every currency is 100; the exceptions
 * that matter are the zero-decimal ones (JPY, KRW) and the three-decimal Gulf
 * currencies. Getting this wrong silently multiplies every price by a hundred,
 * so it is a table rather than an assumption.
 */
const MINOR_UNITS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
};

export function minorUnitDigits(currency: string = STORE_CURRENCY): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2;
}

function factor(currency: string): number {
  return 10 ** minorUnitDigits(currency);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, exact: boolean): Intl.NumberFormat {
  const key = `${currency}:${exact}`;
  const existing = formatters.get(key);
  if (existing) return existing;

  const digits = minorUnitDigits(currency);
  const made = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    // Shelf prices drop the cents when there are none to show; an invoice
    // always shows them, because a total that reads $1,299 next to lines that
    // add up to $1,298.99 looks like an error even when it is rounding.
    minimumFractionDigits: exact ? digits : 0,
    maximumFractionDigits: digits,
  });
  formatters.set(key, made);
  return made;
}

/** $1,299 — for prices on screen. */
export function formatMoney(
  minor: number,
  currency: string = STORE_CURRENCY,
): string {
  return formatter(currency, false).format(Math.round(minor) / factor(currency));
}

/** $1,299.00 — for invoice and order lines, where the cents have to be shown. */
export function formatMoneyExact(
  minor: number,
  currency: string = STORE_CURRENCY,
): string {
  return formatter(currency, true).format(minor / factor(currency));
}

export function discountPercent(listMinor: number, priceMinor: number): number {
  if (listMinor <= 0 || priceMinor >= listMinor) return 0;
  return Math.round(((listMinor - priceMinor) / listMinor) * 100);
}
