/**
 * Who the seller legally is.
 *
 * An online marketplace in India has to publish its legal name and address,
 * customer-care contact, and a named grievance officer with a means of
 * contacting them — the Consumer Protection (E-Commerce) Rules, 2020. This is
 * also, separately, most of what makes a first-time buyer willing to enter a
 * card number.
 *
 * Every value comes from the environment and nothing is invented. A field that
 * is not configured is not rendered, and `configWarnings()` lists what is
 * missing so it shows up before launch instead of after.
 */

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export type SiteConfig = {
  tradingName: string;
  legalName: string | null;
  address: string | null;
  gstin: string | null;
  cin: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  grievanceName: string | null;
  grievanceEmail: string | null;
  grievancePhone: string | null;
};

export function getSiteConfig(): SiteConfig {
  return {
    tradingName: env("COMPANY_TRADING_NAME") ?? "Vertex Infosolutions",
    legalName: env("COMPANY_LEGAL_NAME"),
    address: env("COMPANY_ADDRESS"),
    gstin: env("COMPANY_GSTIN"),
    cin: env("COMPANY_CIN"),
    supportEmail: env("COMPANY_SUPPORT_EMAIL"),
    supportPhone: env("COMPANY_SUPPORT_PHONE"),
    grievanceName: env("COMPANY_GRIEVANCE_OFFICER_NAME"),
    grievanceEmail: env("COMPANY_GRIEVANCE_OFFICER_EMAIL"),
    grievancePhone: env("COMPANY_GRIEVANCE_OFFICER_PHONE"),
  };
}

/**
 * What still has to be filled in before this store can legally take an order.
 * Rendered as a banner in development and never in production — the point is to
 * be impossible to forget, not to tell customers what is missing.
 */
export function configWarnings(config: SiteConfig): string[] {
  const missing: string[] = [];
  if (!config.legalName) missing.push("COMPANY_LEGAL_NAME");
  if (!config.address) missing.push("COMPANY_ADDRESS");
  if (!config.gstin) missing.push("COMPANY_GSTIN");
  if (!config.supportEmail) missing.push("COMPANY_SUPPORT_EMAIL");
  if (!config.supportPhone) missing.push("COMPANY_SUPPORT_PHONE");
  if (!config.grievanceName || !config.grievanceEmail) {
    missing.push(
      "COMPANY_GRIEVANCE_OFFICER_NAME / COMPANY_GRIEVANCE_OFFICER_EMAIL",
    );
  }
  return missing;
}
