import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

/**
 * Settings an administrator can change without a deployment.
 *
 * Two places hold a value and the order between them is fixed: a row in the
 * `Setting` table wins, and the App Service setting is what is used when there
 * is no row. That way the settings page is authoritative for anything typed
 * into it, the server settings still work for anything never touched, and
 * clearing a field on the page falls back rather than blanking the shop. The
 * page shows both values side by side, because "which one is the site actually
 * using?" is otherwise unanswerable without a deploy.
 *
 * What is not here matters as much as what is. Nothing that is a secret or a
 * key to something else — the database URL, the Stripe keys, the mail
 * credentials, the WhatsApp token, the scheduled-job secret — can be set from
 * a web page, because anything that reaches this table can then read it, and
 * that includes every bug in this application. `ADMIN_EMAILS` stays out for a
 * sharper version of the same reason: the list of people allowed to use this
 * page must not be editable from it, or one compromised session becomes
 * permanent access.
 */

/**
 * Every key the settings page may write, with what it is for.
 *
 * An allowlist rather than "whatever the form posts". The form is a web page
 * and its field names arrive from the browser; without this, a crafted request
 * could write `STRIPE_SECRET_KEY` into the table and whatever read it next
 * would trust it.
 */
export const EDITABLE_SETTINGS = {
  COMPANY_TRADING_NAME: "The name customers see, in the header and the footer.",
  COMPANY_LEGAL_NAME: "The registered entity. Printed on every invoice.",
  COMPANY_ADDRESS:
    "The registered address, as it appears on the GST certificate. Required before an order can be taken from the EU or the UK.",
  COMPANY_SHIPS_FROM: "The country a supply is made from. Decides which export rules apply.",
  COMPANY_REGISTRATION_LABEL: "What the registration number is called — CIN, Company No.",
  COMPANY_REGISTRATION_NUMBER: "The registration number itself.",
  COMPANY_TAX_ID_LABEL: "What the tax number is called — GSTIN, VAT number.",
  COMPANY_TAX_ID: "The tax number itself. On every GST invoice.",
  COMPANY_SUPPORT_EMAIL:
    "Where customers write, and where enquiries from the contact form are sent. It has to be a mailbox somebody reads.",
  COMPANY_SUPPORT_HOURS: "Given with a UTC offset, because the reader is usually in another one.",
  COMPANY_COMPLAINTS_OFFICER_NAME: "A named person who answers escalated complaints.",
  COMPANY_COMPLAINTS_OFFICER_EMAIL: "Where to write to them.",
  BANK_ACCOUNT_NAME: "The name on the account.",
  BANK_ACCOUNT_NUMBER: "Shown only to a customer with an unpaid transfer order.",
  BANK_IFSC: "Required with the account number — one without the other cannot be paid into.",
  BANK_NAME: "The bank.",
  BANK_BRANCH: "Optional.",
  BANK_SWIFT: "For a payer abroad. Leave empty until the bank issues one.",
  GTM_ID: "The Google Tag Manager container. Analytics load only for a visitor who has agreed.",
  GTM_DISABLED: 'Set to 1 to load no analytics at all, whatever the container says.',
} as const;

export type SettingKey = keyof typeof EDITABLE_SETTINGS;

export function isEditableSetting(key: string): key is SettingKey {
  return Object.hasOwn(EDITABLE_SETTINGS, key);
}

/**
 * Every stored override, once per request.
 *
 * One query rather than one per field: the footer alone reads six of these,
 * and a settings lookup per value would put twenty round trips on every page
 * of the shop.
 */
export const storedSettings = cache(async function storedSettings(): Promise<
  Map<string, string>
> {
  try {
    const rows = await prisma.setting.findMany({ select: { key: true, value: true } });
    return new Map(rows.map((row) => [row.key, row.value]));
  } catch {
    // A shop that cannot read its settings table must still render. Every
    // caller has an App Service setting or a default behind it, so falling
    // back here degrades to exactly the behaviour before this table existed.
    return new Map();
  }
});

/** What the App Service holds, or null when it holds nothing. */
export function serverValue(key: string): string | null {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : null;
}

/** The value in force: the stored one, else the server one, else nothing. */
export async function settingValue(key: string): Promise<string | null> {
  const stored = (await storedSettings()).get(key)?.trim();
  return stored && stored.length > 0 ? stored : serverValue(key);
}

/** Where a value came from, for the settings page to show. */
export type SettingSource = "stored" | "server" | "unset";

export async function settingRows(): Promise<
  { key: SettingKey; label: string; value: string; server: string | null; source: SettingSource }[]
> {
  const stored = await storedSettings();
  return (Object.keys(EDITABLE_SETTINGS) as SettingKey[]).map((key) => {
    const own = stored.get(key)?.trim() ?? "";
    const server = serverValue(key);
    return {
      key,
      label: EDITABLE_SETTINGS[key],
      value: own || server || "",
      server,
      source: own ? "stored" : server ? "server" : "unset",
    };
  });
}
