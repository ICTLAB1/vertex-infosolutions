/**
 * Which market a visitor is in, and what follows from that.
 *
 * The store sells into two: India, priced in INR with GST charged; and
 * everywhere else, priced in USD as a zero-rated export. Almost every
 * customer-facing difference in this codebase traces back to which of those a
 * request belongs to, so it is resolved once, here, and passed down.
 */

export type CurrencyCode = "INR" | "USD";

export type Market = {
  currency: CurrencyCode;
  /** ISO 3166-1 alpha-2, when known. */
  country: string | null;
  /** True when this is a domestic Indian supply, so GST applies. */
  domestic: boolean;
  /** How the market was decided, so the UI can say so honestly. */
  source: "chosen" | "geo" | "language" | "default";
};

export const CURRENCIES: Record<
  CurrencyCode,
  { code: CurrencyCode; symbol: string; label: string }
> = {
  INR: { code: "INR", symbol: "₹", label: "India (INR)" },
  USD: { code: "USD", symbol: "$", label: "International (USD)" },
};

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export function isCurrency(value: string): value is CurrencyCode {
  return value === "INR" || value === "USD";
}

/** India is the one country priced in rupees. */
export function currencyForCountry(country: string | null): CurrencyCode {
  return country?.toUpperCase() === "IN" ? "INR" : "USD";
}

/**
 * Headers that carry the caller's country, in the order they are trusted.
 *
 * None of these exists by default on Azure App Service. Front Door can be
 * configured to add one, or a geo-IP lookup can set `x-country-code` at the
 * edge — `GEO_COUNTRY_HEADER` names whichever is actually in use. Until one is
 * wired up, resolution falls through to the language header, which is a weaker
 * signal but better than assuming everyone is American.
 */
const GEO_HEADERS = [
  process.env.GEO_COUNTRY_HEADER,
  "cf-ipcountry", // Cloudflare
  "x-country-code", // a geo-IP rule at the edge
  "x-appengine-country",
  "x-vercel-ip-country",
].filter((name): name is string => Boolean(name));

function fromGeo(headers: Headers): string | null {
  for (const name of GEO_HEADERS) {
    const value = headers.get(name)?.trim().toUpperCase();
    // Cloudflare sends XX for anonymised or unknown callers.
    if (value && value.length === 2 && value !== "XX" && value !== "T1") {
      return value;
    }
  }
  return null;
}

/**
 * A last resort. `en-IN` says something about where somebody is; `en-GB` says
 * rather less, and `en-US` is the default on half the devices on earth. So a
 * region tag is read only when it is present, and only to distinguish India
 * from everywhere else — which is the only distinction this store makes.
 */
function fromLanguage(headers: Headers): string | null {
  const header = headers.get("accept-language");
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim();
    const region = tag.split("-")[1];
    if (region && region.length === 2) return region.toUpperCase();
  }
  return null;
}

/**
 * Resolve the market for a request.
 *
 * An explicit choice always wins. Somebody in London buying for an Indian
 * office, or an Indian traveller abroad, knows their own situation better than
 * an IP lookup does, and a store that overrides them is a store they leave.
 */
export function resolveMarket(
  headers: Headers,
  chosen: string | null | undefined,
): Market {
  if (chosen && isCurrency(chosen)) {
    return {
      currency: chosen,
      country: chosen === "INR" ? "IN" : null,
      domestic: chosen === "INR",
      source: "chosen",
    };
  }

  const geo = fromGeo(headers);
  if (geo) {
    const currency = currencyForCountry(geo);
    return {
      currency,
      country: geo,
      domestic: geo === "IN",
      source: "geo",
    };
  }

  const language = fromLanguage(headers);
  if (language) {
    const currency = currencyForCountry(language);
    return {
      currency,
      country: language,
      domestic: language === "IN",
      source: "language",
    };
  }

  return {
    currency: DEFAULT_CURRENCY,
    country: null,
    domestic: false,
    source: "default",
  };
}

/**
 * Countries the store will not supply, physically or electronically.
 *
 * A licensed product is an export even though it travels by email, and
 * supplying one
 * into a comprehensively sanctioned territory is a criminal matter rather than
 * a commercial one. This list is a floor, not a compliance programme: it has to
 * be reviewed against current sanctions, and against the store's obligations as
 * an Indian exporter, before launch.
 */
export const RESTRICTED_COUNTRIES: { code: string; name: string }[] = [
  { code: "BY", name: "Belarus" },
  { code: "CU", name: "Cuba" },
  { code: "IR", name: "Iran" },
  { code: "KP", name: "North Korea" },
  { code: "RU", name: "Russia" },
  { code: "SY", name: "Syria" },
];

const RESTRICTED = new Set(RESTRICTED_COUNTRIES.map((c) => c.code));

export function isRestricted(code: string | null): boolean {
  return code ? RESTRICTED.has(code.toUpperCase()) : false;
}

/**
 * Billing countries offered at checkout. A licence needs no delivery address,
 * but a card issuer needs a billing country and a GST invoice needs to know
 * whether the buyer is in India.
 */
export const BILLING_COUNTRIES: { code: string; name: string }[] = [
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AR", name: "Argentina" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "BE", name: "Belgium" },
  { code: "BH", name: "Bahrain" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Switzerland" },
  { code: "CL", name: "Chile" },
  { code: "CZ", name: "Czechia" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "HK", name: "Hong Kong SAR" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "KR", name: "South Korea" },
  { code: "KW", name: "Kuwait" },
  { code: "MX", name: "Mexico" },
  { code: "MY", name: "Malaysia" },
  { code: "NG", name: "Nigeria" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "NZ", name: "New Zealand" },
  { code: "OM", name: "Oman" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SE", name: "Sweden" },
  { code: "SG", name: "Singapore" },
  { code: "TH", name: "Thailand" },
  { code: "US", name: "United States" },
  { code: "VN", name: "Vietnam" },
  { code: "ZA", name: "South Africa" },
];

const COUNTRY_NAMES = new Map<string, string>([
  ...BILLING_COUNTRIES.map((c) => [c.code, c.name] as const),
  ...RESTRICTED_COUNTRIES.map((c) => [c.code, c.name] as const),
]);

export function countryName(code: string): string {
  return COUNTRY_NAMES.get(code.toUpperCase()) ?? code.toUpperCase();
}

export function isKnownBillingCountry(code: string): boolean {
  return BILLING_COUNTRIES.some((c) => c.code === code.toUpperCase());
}

/**
 * A GSTIN is 15 characters: two state digits, a ten-character PAN, an entity
 * digit, a fixed 'Z', and a checksum. Validated by shape only — the checksum
 * belongs to a real GST lookup, which is a launch task rather than a regex.
 */
export function looksLikeGstin(value: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    value.trim().toUpperCase(),
  );
}
