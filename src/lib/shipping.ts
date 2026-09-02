/**
 * Shipping across a border.
 *
 * Everything here answers one of three questions: can we send it there, what
 * does carriage cost, and when will it realistically arrive. The estimates are
 * deliberately conservative and quoted as a range, because a cross-border
 * parcel clears customs on the destination's schedule and not on ours. A single
 * confident date would be a promise the store does not control.
 *
 * The rate card is data rather than logic so a commercial change is a change to
 * a table. A real deployment replaces `quote()` with the carrier's own rating
 * API and keeps the rest.
 */

export type ZoneId = "NA" | "UKEU" | "GULF" | "APAC" | "ROW";

export type Zone = {
  id: ZoneId;
  label: string;
  /** Flat carriage, in the store's minor units. */
  shippingMinor: number;
  /** Carriage is waived above this order value. */
  freeOverMinor: number;
  /** Transit after dispatch, in business days, as a range. */
  transitDays: [number, number];
};

export const ZONES: Record<ZoneId, Zone> = {
  NA: {
    id: "NA",
    label: "United States & Canada",
    shippingMinor: 29_00,
    freeOverMinor: 500_00,
    transitDays: [3, 6],
  },
  UKEU: {
    id: "UKEU",
    label: "United Kingdom & Europe",
    shippingMinor: 39_00,
    freeOverMinor: 600_00,
    transitDays: [4, 8],
  },
  GULF: {
    id: "GULF",
    label: "Gulf & Middle East",
    shippingMinor: 25_00,
    freeOverMinor: 400_00,
    transitDays: [3, 6],
  },
  APAC: {
    id: "APAC",
    label: "Asia Pacific",
    shippingMinor: 35_00,
    freeOverMinor: 600_00,
    transitDays: [4, 9],
  },
  ROW: {
    id: "ROW",
    label: "Rest of world",
    shippingMinor: 59_00,
    freeOverMinor: 900_00,
    transitDays: [7, 15],
  },
};

type Country = { code: string; name: string; zone: ZoneId };

/**
 * Destinations the store quotes for. A country absent from this list still
 * reaches checkout under `ROW` only if it is added here — an unknown code is
 * refused rather than guessed at, because guessing a zone means quoting a
 * carriage price the store cannot honour.
 */
export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", zone: "NA" },
  { code: "CA", name: "Canada", zone: "NA" },
  { code: "MX", name: "Mexico", zone: "ROW" },

  { code: "GB", name: "United Kingdom", zone: "UKEU" },
  { code: "IE", name: "Ireland", zone: "UKEU" },
  { code: "DE", name: "Germany", zone: "UKEU" },
  { code: "FR", name: "France", zone: "UKEU" },
  { code: "NL", name: "Netherlands", zone: "UKEU" },
  { code: "BE", name: "Belgium", zone: "UKEU" },
  { code: "ES", name: "Spain", zone: "UKEU" },
  { code: "PT", name: "Portugal", zone: "UKEU" },
  { code: "IT", name: "Italy", zone: "UKEU" },
  { code: "AT", name: "Austria", zone: "UKEU" },
  { code: "CH", name: "Switzerland", zone: "UKEU" },
  { code: "SE", name: "Sweden", zone: "UKEU" },
  { code: "NO", name: "Norway", zone: "UKEU" },
  { code: "DK", name: "Denmark", zone: "UKEU" },
  { code: "FI", name: "Finland", zone: "UKEU" },
  { code: "PL", name: "Poland", zone: "UKEU" },
  { code: "CZ", name: "Czechia", zone: "UKEU" },

  { code: "AE", name: "United Arab Emirates", zone: "GULF" },
  { code: "SA", name: "Saudi Arabia", zone: "GULF" },
  { code: "QA", name: "Qatar", zone: "GULF" },
  { code: "KW", name: "Kuwait", zone: "GULF" },
  { code: "BH", name: "Bahrain", zone: "GULF" },
  { code: "OM", name: "Oman", zone: "GULF" },

  { code: "SG", name: "Singapore", zone: "APAC" },
  { code: "MY", name: "Malaysia", zone: "APAC" },
  { code: "HK", name: "Hong Kong SAR", zone: "APAC" },
  { code: "JP", name: "Japan", zone: "APAC" },
  { code: "KR", name: "South Korea", zone: "APAC" },
  { code: "AU", name: "Australia", zone: "APAC" },
  { code: "NZ", name: "New Zealand", zone: "APAC" },
  { code: "TH", name: "Thailand", zone: "APAC" },
  { code: "PH", name: "Philippines", zone: "APAC" },
  { code: "ID", name: "Indonesia", zone: "APAC" },
  { code: "VN", name: "Vietnam", zone: "APAC" },

  { code: "ZA", name: "South Africa", zone: "ROW" },
  { code: "KE", name: "Kenya", zone: "ROW" },
  { code: "NG", name: "Nigeria", zone: "ROW" },
  { code: "EG", name: "Egypt", zone: "ROW" },
  { code: "BR", name: "Brazil", zone: "ROW" },
  { code: "CL", name: "Chile", zone: "ROW" },
  { code: "AR", name: "Argentina", zone: "ROW" },
];

/**
 * Destinations the store will not send to at all, physical or digital.
 *
 * IT hardware and licensed software are export-controlled goods, and shipping
 * them into a comprehensively sanctioned territory is a criminal matter rather
 * than a commercial one. This list is a floor, not a compliance programme: it
 * is checked before a quote is given, and it has to be reviewed against the
 * current sanctions lists — and against the store's own obligations as an
 * Indian exporter — before launch.
 */
export const RESTRICTED_COUNTRIES: { code: string; name: string }[] = [
  { code: "BY", name: "Belarus" },
  { code: "CU", name: "Cuba" },
  { code: "IR", name: "Iran" },
  { code: "KP", name: "North Korea" },
  { code: "RU", name: "Russia" },
  { code: "SY", name: "Syria" },
];

export const RESTRICTED = new Set(RESTRICTED_COUNTRIES.map((c) => c.code));

/**
 * Names for every code the store knows, quotable or not. A restricted
 * destination has to be nameable too: "we cannot ship to RU" is a worse
 * refusal than "we cannot ship to Russia", and the export compliance page
 * lists these by name.
 */
const NAMES = new Map<string, string>([
  ...COUNTRIES.map((c) => [c.code, c.name] as const),
  ...RESTRICTED_COUNTRIES.map((c) => [c.code, c.name] as const),
]);

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export function countryName(code: string): string {
  return NAMES.get(code.toUpperCase()) ?? code.toUpperCase();
}

export function isRestricted(code: string): boolean {
  return RESTRICTED.has(code.toUpperCase());
}

export function zoneFor(code: string): Zone | null {
  const country = BY_CODE.get(code.toUpperCase());
  return country ? ZONES[country.zone] : null;
}

export type ShippingQuote =
  | { ok: true; zone: Zone; shippingMinor: number; free: boolean }
  | { ok: false; reason: "restricted" | "unsupported" };

/**
 * What carriage costs to a destination, given what is being shipped. Called
 * with the value of the *physical* part of a basket only — a licence has
 * nothing to carry, and charging freight on a download is exactly the kind of
 * detail that makes a checkout feel dishonest.
 */
export function quote(
  countryCode: string,
  physicalSubtotalMinor: number,
): ShippingQuote {
  const code = countryCode.trim().toUpperCase();
  if (isRestricted(code)) return { ok: false, reason: "restricted" };

  const zone = zoneFor(code);
  if (!zone) return { ok: false, reason: "unsupported" };

  if (physicalSubtotalMinor <= 0) {
    return { ok: true, zone, shippingMinor: 0, free: true };
  }

  const free = physicalSubtotalMinor >= zone.freeOverMinor;
  return {
    ok: true,
    zone,
    shippingMinor: free ? 0 : zone.shippingMinor,
    free,
  };
}

function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}

/**
 * When a shipment should arrive, as a range. `leadDays` is how long the item
 * takes to leave the warehouse; the zone supplies transit, which already
 * allows for a customs hold at the far end.
 */
export function estimateArrival(
  countryCode: string | null,
  leadDays: number,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const zone = countryCode ? zoneFor(countryCode) : null;
  const [min, max] = zone?.transitDays ?? [5, 12];
  return {
    from: addBusinessDays(now, leadDays + min),
    to: addBusinessDays(now, leadDays + max),
  };
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

const dayFormatFull = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function formatArrival(range: { from: Date; to: Date }): string {
  return `${dayFormat.format(range.from)} – ${dayFormat.format(range.to)}`;
}

export function formatDay(date: Date): string {
  return dayFormatFull.format(date);
}

/**
 * Whether an address looks plausible for its country. This is intentionally
 * loose: postal codes vary enormously, several countries have none at all, and
 * a checkout that rejects a valid address is far more costly than one that
 * accepts a typo the carrier will query.
 */
export function postcodeLooksValid(code: string, countryCode: string): boolean {
  const value = code.trim();
  const country = countryCode.toUpperCase();

  // Countries that genuinely do not use postal codes.
  const NONE = new Set(["AE", "HK", "IE", "PA", "QA"]);
  if (NONE.has(country)) return true;

  if (country === "US") return /^\d{5}(-\d{4})?$/.test(value);
  if (country === "CA") return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(value);
  if (country === "GB") return /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(value);

  return value.length >= 3 && value.length <= 12;
}
