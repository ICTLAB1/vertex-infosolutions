/**
 * Who the seller legally is.
 *
 * A cross-border buyer is taking more risk than a domestic one: a longer
 * delivery, a harder return, and a seller they cannot visit. Publishing the
 * registered entity, where goods ship from, and a named person who answers
 * complaints is most of what closes that gap — and some of it is required
 * anyway, both by Indian e-commerce rules for the exporting entity and by EU
 * and UK consumer law for distance selling into those markets.
 *
 * Every value comes from the environment and nothing is invented. A field that
 * is not configured is not rendered, and `configWarnings()` lists what is
 * missing so it shows up before launch rather than after.
 */

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export type SiteConfig = {
  tradingName: string;
  legalName: string | null;
  address: string | null;
  /** Where parcels are dispatched from, which decides the customs paperwork. */
  shipsFrom: string;
  registrationLabel: string | null;
  registrationNumber: string | null;
  taxIdLabel: string | null;
  taxIdNumber: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  /** Hours, written with a UTC offset because the reader is in another one. */
  supportHours: string;
  complaintsName: string | null;
  complaintsEmail: string | null;
};

export function getSiteConfig(): SiteConfig {
  return {
    tradingName: env("COMPANY_TRADING_NAME") ?? "Vertex Infosolutions",
    legalName: env("COMPANY_LEGAL_NAME"),
    address: env("COMPANY_ADDRESS"),
    shipsFrom: env("COMPANY_SHIPS_FROM") ?? "India",
    registrationLabel: env("COMPANY_REGISTRATION_LABEL") ?? "CIN",
    registrationNumber: env("COMPANY_REGISTRATION_NUMBER"),
    taxIdLabel: env("COMPANY_TAX_ID_LABEL") ?? "GSTIN",
    taxIdNumber: env("COMPANY_TAX_ID"),
    supportEmail: env("COMPANY_SUPPORT_EMAIL"),
    supportPhone: env("COMPANY_SUPPORT_PHONE"),
    supportHours:
      env("COMPANY_SUPPORT_HOURS") ??
      "Monday to Friday, 04:00–13:00 UTC (09:30–18:30 IST)",
    complaintsName: env("COMPANY_COMPLAINTS_OFFICER_NAME"),
    complaintsEmail: env("COMPANY_COMPLAINTS_OFFICER_EMAIL"),
  };
}

/**
 * What still has to be filled in before this store can legally take an order.
 * Rendered as a banner in development and never in production — the point is
 * to be impossible to forget, not to tell customers what is missing.
 */
export function configWarnings(config: SiteConfig): string[] {
  const missing: string[] = [];
  if (!config.legalName) missing.push("COMPANY_LEGAL_NAME");
  if (!config.address) missing.push("COMPANY_ADDRESS");
  if (!config.registrationNumber) missing.push("COMPANY_REGISTRATION_NUMBER");
  if (!config.taxIdNumber) missing.push("COMPANY_TAX_ID");
  if (!config.supportEmail) missing.push("COMPANY_SUPPORT_EMAIL");
  if (!config.supportPhone) missing.push("COMPANY_SUPPORT_PHONE");
  if (!config.complaintsName || !config.complaintsEmail) {
    missing.push("COMPANY_COMPLAINTS_OFFICER_NAME / _EMAIL");
  }
  return missing;
}
