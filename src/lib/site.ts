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
  /**
   * Where a bank transfer goes.
   *
   * Bank transfer is an offered payment method, so without this the store
   * takes an order, emails the customer that it is waiting for the funds, and
   * never says where to send them. Shown to somebody who has placed an order
   * and nowhere else — not because an account number is a secret (it is on
   * every invoice this business issues) but because a public page is where
   * somebody else's account number gets substituted for yours.
   */
  bank: BankDetails | null;
};

export type BankDetails = {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string | null;
  /** For a payer abroad. Absent until the bank issues one. */
  swift: string | null;
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
    bank: bankDetails(),
  };
}

/**
 * All of it or none of it.
 *
 * A half-configured account is worse than none: an account number with no
 * IFSC cannot be paid into, and printing it invites somebody to try. So the
 * three that a transfer actually needs are required together, and anything
 * short of that reads as "bank transfer is not set up".
 */
function bankDetails(): BankDetails | null {
  const accountNumber = env("BANK_ACCOUNT_NUMBER");
  const ifsc = env("BANK_IFSC");
  const bankName = env("BANK_NAME");
  if (!accountNumber || !ifsc || !bankName) return null;

  return {
    accountName:
      env("BANK_ACCOUNT_NAME") ??
      env("COMPANY_TRADING_NAME") ??
      "Vertex Infosolutions",
    accountNumber,
    ifsc,
    bankName,
    branch: env("BANK_BRANCH"),
    swift: env("BANK_SWIFT"),
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
  // No phone number is deliberate, not an omission: this shop is contacted by
  // email. Every surface that would print one already hides it when unset, so
  // there is nothing to warn about — and a warning that is always on is a
  // warning nobody reads.
  if (!config.complaintsName || !config.complaintsEmail) {
    missing.push("COMPANY_COMPLAINTS_OFFICER_NAME / _EMAIL");
  }
  // Only worth warning about while bank transfer is on the checkout. If it is
  // ever taken off, this becomes noise rather than a gap.
  if (!config.bank) {
    missing.push("BANK_ACCOUNT_NUMBER / BANK_IFSC / BANK_NAME");
  }
  return missing;
}

/**
 * The bank details as a payer needs to read them.
 *
 * One function, used by the email and by the order page, because two copies of
 * an account number is one copy that eventually says something different. The
 * order reference goes on the transfer: it is the only thing that ties a line
 * on a bank statement to an order, and reconciling without it is guesswork.
 */
export function bankTransferLines(
  bank: BankDetails,
  reference: string,
  currency: string,
): string[] {
  return [
    `Account name:   ${bank.accountName}`,
    `Account number: ${bank.accountNumber}`,
    `IFSC:           ${bank.ifsc}`,
    `Bank:           ${bank.bankName}${bank.branch ? `, ${bank.branch}` : ""}`,
    ...(bank.swift ? [`SWIFT:          ${bank.swift}`] : []),
    `Reference:      ${reference}`,
    ...(currency === "INR"
      ? []
      : [
          "",
          "Please send the amount shown, in the currency shown. Your bank's",
          "conversion and any correspondent charges are not included in it, and",
          "an order that arrives short cannot be released until the balance does.",
        ]),
  ];
}
