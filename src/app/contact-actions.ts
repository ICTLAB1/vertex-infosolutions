"use server";

import { headers } from "next/headers";

import { getMarket } from "@/lib/cart";
import {
  KIND_LABELS,
  enquiryLimitReached,
  looksLikeEmail,
  recordEnquiry,
} from "@/lib/enquiries";
import { notify } from "@/lib/notify";
import { clientIp } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/seo";
import { getSiteConfig } from "@/lib/site";
import type { EnquiryKind } from "@/generated/prisma/enums";

export type EnquiryResult =
  | { ok: true; message: string }
  | { ok: false; message: string; values?: Record<string, string> }
  | null;

const KINDS: EnquiryKind[] = ["GENERAL", "VOLUME_QUOTE", "LICENSING"];

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Take a question from somebody who has not bought anything yet.
 *
 * Recorded before either message is sent, and the send failing does not lose
 * it. That ordering is the whole point: the shop invites a quote on five
 * surfaces, and an enquiry that exists only as an email is one bounced message
 * away from never having happened.
 *
 * Two things guard the form. A hidden field no person can see and no browser
 * fills in catches the simplest bots, and a per-address limit catches the rest
 * — loose enough that somebody who spots a typo and sends again is never
 * blocked.
 */
export async function submitEnquiry(
  _previous: EnquiryResult,
  form: FormData,
): Promise<EnquiryResult> {
  // The honeypot. Named plausibly enough that a bot fills it in.
  if (str(form, "website")) {
    // Answered as though it worked. Telling a bot it was detected only teaches
    // whoever wrote it to try something else.
    return { ok: true, message: "Thank you — your message has been sent." };
  }

  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const company = str(form, "company");
  const phone = str(form, "phone");
  const message = str(form, "message");
  const productSlug = str(form, "productSlug");
  const rawKind = str(form, "kind") as EnquiryKind;
  const kind: EnquiryKind = KINDS.includes(rawKind) ? rawKind : "GENERAL";

  // Echoed back on any rejection: React empties an uncontrolled form once a
  // server action returns, and retyping a paragraph because a field was
  // missing is how somebody decides not to bother.
  const values = { name, email, company, phone, message, kind };

  if (!name || !email || !message) {
    return {
      ok: false,
      message: "Name, email and a message are needed — the rest is optional.",
      values,
    };
  }
  if (!looksLikeEmail(email)) {
    return { ok: false, message: "That email address does not look right.", values };
  }
  if (message.length < 10) {
    return {
      ok: false,
      message: "Tell us a little more — a line or two is enough.",
      values,
    };
  }

  const ip = clientIp(await headers());
  if (await enquiryLimitReached(ip)) {
    return {
      ok: false,
      message:
        "That is several messages in an hour. They have all reached us — give us a chance to reply before sending another.",
      values,
    };
  }

  const market = await getMarket();
  await recordEnquiry({
    kind,
    name,
    email,
    company,
    phone,
    message,
    productSlug,
    currency: market.currency,
    country: market.country ?? undefined,
    ip,
  });

  const config = (await getSiteConfig());
  const label = KIND_LABELS[kind];

  // To us. Without a support address configured the enquiry is still recorded
  // and visible in the back office — it simply is not pushed anywhere.
  if (config.supportEmail) {
    await notify(
      "enquiry.received",
      { email: config.supportEmail },
      {
        kindLabel: label,
        name,
        email,
        company,
        phone,
        message,
        productSlug,
        market: `${market.currency}${market.country ? ` · ${market.country}` : ""}`,
        adminUrl: `${siteUrl()}/admin/enquiries`,
      },
    );
  }

  // To them, so a question does not vanish into silence.
  await notify(
    "enquiry.acknowledged",
    { email },
    { name, message, kindLabel: label },
  );

  return {
    ok: true,
    message:
      kind === "VOLUME_QUOTE"
        ? "Thank you — we will come back with a firm price within one business day."
        : "Thank you — your message has reached us and we answer within one business day.",
  };
}
