import "server-only";

import { prisma } from "@/lib/db";
import type { EnquiryKind } from "@/generated/prisma/enums";

/**
 * How often one caller may ask.
 *
 * Loose enough that a customer who sends a question, spots a typo and sends it
 * again is never blocked; tight enough that a form on a public page does not
 * become somebody's mailing list. Counted per address rather than per hour of
 * the day, because the abuse this stops is one script submitting repeatedly,
 * not a busy afternoon.
 */
export const ENQUIRY_LIMITS = { perIp: 6, windowMinutes: 60 } as const;

/** How each kind is named to a person, in the back office and in our own email. */
export const KIND_LABELS: Record<EnquiryKind, string> = {
  GENERAL: "Enquiry",
  // Covers both reasons somebody asks for a figure: a volume band the cart
  // cannot charge, and a licence we publish no price for at all.
  VOLUME_QUOTE: "Quote request",
  LICENSING: "Licensing question",
};

export type EnquiryInput = {
  kind: EnquiryKind;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message: string;
  productSlug?: string;
  currency?: string;
  country?: string;
  ip?: string;
};

/**
 * Whether this caller has asked too many times already.
 *
 * Reads the enquiries themselves rather than a separate counter: one table,
 * one truth, and the count is exactly what an administrator would see if they
 * looked. The trade is that it costs a query — at this volume, nothing.
 */
export async function enquiryLimitReached(ip: string): Promise<boolean> {
  if (ip === "unknown") return false;

  const since = new Date(Date.now() - ENQUIRY_LIMITS.windowMinutes * 60 * 1000);
  const recent = await prisma.enquiry.count({
    where: { createdAt: { gte: since }, ip },
  });
  return recent >= ENQUIRY_LIMITS.perIp;
}

/** Very deliberately not a validator that rejects real people. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export async function recordEnquiry(input: EnquiryInput) {
  return prisma.enquiry.create({
    data: {
      kind: input.kind,
      name: input.name.slice(0, 120),
      email: input.email.toLowerCase().slice(0, 200),
      company: input.company?.slice(0, 160) || null,
      phone: input.phone?.slice(0, 40) || null,
      message: input.message.slice(0, 4000),
      productSlug: input.productSlug?.slice(0, 200) || null,
      currency: input.currency ?? null,
      country: input.country ?? null,
      ip: input.ip && input.ip !== "unknown" ? input.ip : null,
    },
    select: { id: true, kind: true, email: true, name: true },
  });
}
