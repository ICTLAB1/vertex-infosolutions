import { describe, expect, it } from "vitest";

import {
  countryName,
  currencyForCountry,
  isKnownBillingCountry,
  isRestricted,
  looksLikeGstin,
  resolveMarket,
  BILLING_COUNTRIES,
  RESTRICTED_COUNTRIES,
} from "@/lib/market";

const headers = (init: Record<string, string> = {}) => new Headers(init);

describe("resolveMarket", () => {
  it("prices India in rupees and everywhere else in dollars", () => {
    expect(currencyForCountry("IN")).toBe("INR");
    expect(currencyForCountry("in")).toBe("INR");
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry(null)).toBe("USD");
  });

  it("lets an explicit choice beat the geo header", () => {
    // Somebody in London buying for an Indian office knows their own
    // situation better than an IP lookup does.
    const market = resolveMarket(headers({ "cf-ipcountry": "GB" }), "INR");
    expect(market.currency).toBe("INR");
    expect(market.domestic).toBe(true);
    expect(market.source).toBe("chosen");
  });

  it("ignores a chosen value that is not a currency we sell in", () => {
    const market = resolveMarket(headers({ "cf-ipcountry": "IN" }), "EUR");
    expect(market.currency).toBe("INR");
    expect(market.source).toBe("geo");
  });

  it("reads the geo header when there is no choice", () => {
    expect(resolveMarket(headers({ "cf-ipcountry": "IN" }), null).currency).toBe("INR");
    expect(resolveMarket(headers({ "x-country-code": "DE" }), null).currency).toBe("USD");
  });

  it("ignores Cloudflare's anonymised country codes", () => {
    // XX and T1 mean "unknown" and "Tor". Treating either as a country would
    // price somebody by an accident of their network.
    expect(resolveMarket(headers({ "cf-ipcountry": "XX" }), null).source).toBe("default");
    expect(resolveMarket(headers({ "cf-ipcountry": "T1" }), null).source).toBe("default");
  });

  it("falls back to the language region, then to USD", () => {
    const byLanguage = resolveMarket(
      headers({ "accept-language": "en-IN,en;q=0.9" }),
      null,
    );
    expect(byLanguage.currency).toBe("INR");
    expect(byLanguage.source).toBe("language");

    const nothing = resolveMarket(headers(), null);
    expect(nothing.currency).toBe("USD");
    expect(nothing.source).toBe("default");
    expect(nothing.domestic).toBe(false);
  });

  it("does not read a region from a bare language tag", () => {
    expect(resolveMarket(headers({ "accept-language": "en" }), null).source).toBe(
      "default",
    );
  });
});

describe("export control", () => {
  it("refuses the sanctioned destinations", () => {
    for (const country of RESTRICTED_COUNTRIES) {
      expect(isRestricted(country.code)).toBe(true);
      expect(isRestricted(country.code.toLowerCase())).toBe(true);
    }
    expect(isRestricted("US")).toBe(false);
    expect(isRestricted(null)).toBe(false);
  });

  /**
   * Restricted countries are deliberately absent from the billing list. That
   * is what makes the order of checks in `placeOrder` matter: testing list
   * membership first would refuse them with "choose your billing country" and
   * lose the reason entirely — a bug this suite exists to keep fixed.
   */
  it("keeps restricted countries out of the billing list", () => {
    for (const country of RESTRICTED_COUNTRIES) {
      expect(isKnownBillingCountry(country.code)).toBe(false);
    }
  });

  it("can still name a restricted country", () => {
    expect(countryName("RU")).toBe("Russia");
    expect(countryName("KP")).toBe("North Korea");
  });
});

describe("billing countries", () => {
  it("includes the markets the store actually sells to", () => {
    // The United States was missing from this list once, which meant the
    // largest dollar market could not check out at all.
    for (const code of ["US", "IN", "GB", "DE", "AE", "SG", "AU", "CA"]) {
      expect(isKnownBillingCountry(code)).toBe(true);
    }
  });

  it("has no duplicate codes and names every one", () => {
    const codes = BILLING_COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const country of BILLING_COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(countryName(country.code)).toBe(country.name);
    }
  });
});

describe("looksLikeGstin", () => {
  it("accepts a well-formed GSTIN", () => {
    expect(looksLikeGstin("29ABCDE1234F1Z5")).toBe(true);
    expect(looksLikeGstin(" 29abcde1234f1z5 ")).toBe(true);
  });

  it("rejects anything the wrong shape", () => {
    expect(looksLikeGstin("NOTAGSTIN")).toBe(false);
    expect(looksLikeGstin("29ABCDE1234F1Y5")).toBe(false); // 'Z' is fixed
    expect(looksLikeGstin("29ABCDE1234F1Z")).toBe(false); // too short
    expect(looksLikeGstin("")).toBe(false);
  });
});
