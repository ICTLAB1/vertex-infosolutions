import "server-only";

import { prisma } from "@/lib/db";
import { getSiteConfig } from "@/lib/site";

/**
 * Everything the store sends to a customer.
 *
 * Messages are written to the `Notification` table first and dispatched
 * second. That costs one insert and buys three things: a provider that is
 * briefly down delays a message rather than losing it; "did you send it?" has
 * an answer; and the whole notification path is exercisable in development
 * with no provider configured at all, which is how the flows below were
 * actually tested.
 *
 * Two channels. Email is the record — invoices, licence keys, anything the
 * customer may need in a year. WhatsApp is a nudge: short, timely, and never
 * carrying a licence key, because a WhatsApp message is one forwarded chat away
 * from being somebody else's licence.
 */

export type NotifyTemplate =
  | "otp.verify"
  | "otp.signin"
  | "account.welcome"
  | "order.paid"
  | "order.keys"
  | "order.pending"
  | "licence.expiring";

type Recipient = {
  userId?: string | null;
  orderId?: string | null;
  email: string;
  /** E.164. WhatsApp is skipped without one. */
  phone?: string | null;
  whatsappOptIn?: boolean;
};

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

/**
 * Send an email.
 *
 * Resend's HTTP API, because it is one fetch with no SMTP connection pool to
 * manage from a container that may be scaled to zero. Swapping it for SES or
 * SMTP means changing this function and nothing else.
 */
async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: true; ref: string | null } | { ok: false; error: string }> {
  if (!emailConfigured()) {
    return { ok: false, error: "Email provider not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject,
        text: body,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `${response.status} ${detail.slice(0, 300)}` };
    }
    const payload = (await response.json()) as { id?: string };
    return { ok: true, ref: payload.id ?? null };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 300) };
  }
}

/**
 * Send a WhatsApp message through the Meta Cloud API.
 *
 * A business cannot send free-form WhatsApp to somebody who has not messaged it
 * in the last 24 hours — it has to be a *template* that Meta approved in
 * advance, with variables filled in. So `template` here is not decorative: it
 * names a real approved template, and the variables are positional. Sending an
 * unapproved template fails, and sending unsolicited messages gets the number
 * rate-limited and eventually blocked.
 */
async function sendWhatsApp(
  to: string,
  template: string,
  variables: string[],
): Promise<{ ok: true; ref: string | null } | { ok: false; error: string }> {
  if (!whatsappConfigured()) {
    return { ok: false, error: "WhatsApp provider not configured" };
  }

  const version = process.env.WHATSAPP_API_VERSION ?? "v21.0";
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^\d]/g, ""),
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LOCALE ?? "en" },
          components: [
            {
              type: "body",
              parameters: variables.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `${response.status} ${detail.slice(0, 300)}` };
    }
    const payload = (await response.json()) as {
      messages?: { id?: string }[];
    };
    return { ok: true, ref: payload.messages?.[0]?.id ?? null };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 300) };
  }
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

type Message = {
  subject: string;
  body: string;
  /**
   * The WhatsApp side. Absent means this message is email-only — which is the
   * right answer for anything carrying a licence key or a one-time code.
   */
  whatsapp?: { template: string; variables: string[] };
};

/**
 * WhatsApp template names must exist and be approved in the Meta Business
 * account before anything sends. Listed here so the set is discoverable rather
 * than scattered through the code.
 */
export const WHATSAPP_TEMPLATES = {
  ORDER_PAID: process.env.WHATSAPP_TEMPLATE_ORDER_PAID ?? "vertex_order_paid",
  ORDER_PENDING:
    process.env.WHATSAPP_TEMPLATE_ORDER_PENDING ?? "vertex_order_pending",
  LICENCE_EXPIRING:
    process.env.WHATSAPP_TEMPLATE_LICENCE_EXPIRING ??
    "vertex_licence_expiring",
} as const;

export function compose(
  template: NotifyTemplate,
  data: Record<string, string>,
): Message {
  const config = getSiteConfig();
  const brand = config.tradingName;
  const support = config.supportEmail ?? "our support address";

  switch (template) {
    case "otp.verify":
      return {
        subject: `${data.code} is your ${brand} verification code`,
        body: [
          `Hello ${data.name},`,
          "",
          `Your verification code is ${data.code}.`,
          "",
          `It expires in ${data.ttl}. Enter it on the page you left open to finish setting up your account.`,
          "",
          "If you did not create an account, ignore this email — nothing has been set up and no payment can be taken.",
          "",
          `— ${brand}`,
        ].join("\n"),
        // Never over WhatsApp. A code in a chat thread is a code somebody can
        // read over a shoulder, and it defeats the point of verifying the
        // email address specifically.
      };

    case "otp.signin":
      return {
        subject: `${data.code} is your ${brand} sign-in code`,
        body: [
          `Hello ${data.name},`,
          "",
          `Your sign-in code is ${data.code}. It expires in ${data.ttl}.`,
          "",
          `If this was not you, somebody has your email address but not your password. Nothing has happened to your account, but tell us at ${support}.`,
          "",
          `— ${brand}`,
        ].join("\n"),
      };

    case "account.welcome":
      return {
        subject: `Your ${brand} account is ready`,
        body: [
          `Hello ${data.name},`,
          "",
          "Your email address is verified and your account is ready.",
          "",
          "Every licence you buy is delivered into it and stays there — keys, invoices and renewal dates all in one place, so nothing depends on finding an old email.",
          "",
          `${data.accountUrl}`,
          "",
          `— ${brand}`,
        ].join("\n"),
      };

    case "order.paid":
      return {
        subject: `${brand} order ${data.number} — payment received`,
        body: [
          `Hello ${data.name},`,
          "",
          `We have received your payment of ${data.total} for order ${data.number}.`,
          "",
          `Your licence keys are in your account now: ${data.orderUrl}`,
          "",
          `Your ${data.invoiceKind} is attached to this email and is also available on the order page.`,
          "",
          `— ${brand}`,
        ].join("\n"),
        whatsapp: {
          template: WHATSAPP_TEMPLATES.ORDER_PAID,
          // Positional, matching the approved template's {{1}}..{{4}}.
          variables: [data.name, data.number, data.total, data.orderUrl],
        },
      };

    case "order.keys":
      return {
        subject: `${brand} order ${data.number} — your licence keys`,
        body: [
          `Hello ${data.name},`,
          "",
          `The licence keys for order ${data.number} are ready.`,
          "",
          data.keys,
          "",
          `They are also in your account, permanently: ${data.orderUrl}`,
          "",
          "Keep them somewhere safe. A licence key is the licence.",
          "",
          `— ${brand}`,
        ].join("\n"),
        // Deliberately email-only. A key forwarded in a chat is somebody
        // else's licence.
      };

    case "licence.expiring":
      return {
        subject: `${data.summary} expires on ${data.expiresOn}`,
        body: [
          `Hello ${data.name},`,
          "",
          `${data.summary}, bought on order ${data.number}, expires on ${data.expiresOn} — in ${data.days} days.`,
          "",
          data.licences,
          "",
          "Nothing renews automatically here. If you do nothing, the licence lapses on that date and the software stops. This is a reminder, not a charge, and there is no card on file to charge.",
          "",
          `Renew: ${data.renewUrl}`,
          `Your licences: ${data.accountUrl}`,
          "",
          "Renew before the expiry date where you can. Letting a subscription lapse and restarting it later is sometimes treated as a new purchase at list price rather than a renewal, and with Autodesk in particular that difference is substantial.",
          "",
          `If you have already renewed elsewhere, ignore this — and tell ${support} so we stop reminding you about it.`,
          "",
          `— ${brand}`,
        ].join("\n"),
        whatsapp: {
          template: WHATSAPP_TEMPLATES.LICENCE_EXPIRING,
          variables: [data.name, data.summary, data.expiresOn, data.days],
        },
      };

    case "order.pending":
      return {
        subject: `${brand} order ${data.number} — awaiting payment`,
        body: [
          `Hello ${data.name},`,
          "",
          `We have your order ${data.number} for ${data.total}, and are waiting for the funds to clear.`,
          "",
          "Your licence keys are issued the moment they do, and you will get another email then.",
          "",
          `${data.orderUrl}`,
          "",
          `— ${brand}`,
        ].join("\n"),
        whatsapp: {
          template: WHATSAPP_TEMPLATES.ORDER_PENDING,
          variables: [data.name, data.number, data.total],
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Queue a message and try to send it.
 *
 * Never throws. A notification failing must not roll back the order it is
 * telling somebody about — the payment has already been taken, and the keys
 * are in the account either way. Failures are recorded on the row for a retry
 * sweep to pick up.
 */
export async function notify(
  template: NotifyTemplate,
  recipient: Recipient,
  data: Record<string, string>,
): Promise<void> {
  const message = compose(template, data);

  const emailRow = await prisma.notification.create({
    data: {
      userId: recipient.userId ?? null,
      orderId: recipient.orderId ?? null,
      channel: "EMAIL",
      destination: recipient.email,
      template,
      subject: message.subject,
      body: message.body,
    },
  });

  const emailResult = await sendEmail(
    recipient.email,
    message.subject,
    message.body,
  );
  await prisma.notification.update({
    where: { id: emailRow.id },
    data: emailResult.ok
      ? { status: "SENT", sentAt: new Date(), providerRef: emailResult.ref, attempts: 1 }
      : { status: "FAILED", error: emailResult.error, attempts: 1 },
  });

  if (!emailResult.ok) {
    // Loud in development, where it means a missing key rather than an outage.
    console.warn(`[notify] email ${template} not sent: ${emailResult.error}`);
  }

  if (!message.whatsapp) return;

  // WhatsApp needs both a number and an explicit opt-in. Recorded as SKIPPED
  // rather than silently dropped, so the reason is answerable later.
  if (!recipient.phone || !recipient.whatsappOptIn) {
    await prisma.notification.create({
      data: {
        userId: recipient.userId ?? null,
        orderId: recipient.orderId ?? null,
        channel: "WHATSAPP",
        status: "SKIPPED",
        destination: recipient.phone ?? "—",
        template: message.whatsapp.template,
        body: message.whatsapp.variables.join(" | "),
        error: recipient.phone ? "Not opted in" : "No phone number",
      },
    });
    return;
  }

  const waRow = await prisma.notification.create({
    data: {
      userId: recipient.userId ?? null,
      orderId: recipient.orderId ?? null,
      channel: "WHATSAPP",
      destination: recipient.phone,
      template: message.whatsapp.template,
      body: message.whatsapp.variables.join(" | "),
    },
  });

  const waResult = await sendWhatsApp(
    recipient.phone,
    message.whatsapp.template,
    message.whatsapp.variables,
  );
  await prisma.notification.update({
    where: { id: waRow.id },
    data: waResult.ok
      ? { status: "SENT", sentAt: new Date(), providerRef: waResult.ref, attempts: 1 }
      : { status: "FAILED", error: waResult.error, attempts: 1 },
  });

  if (!waResult.ok) {
    console.warn(`[notify] whatsapp ${template} not sent: ${waResult.error}`);
  }
}

/**
 * Whether a channel can actually deliver right now. Used to warn in
 * development rather than to change behaviour — the outbox records the attempt
 * either way.
 */
export function channelStatus(): { email: boolean; whatsapp: boolean } {
  return { email: emailConfigured(), whatsapp: whatsappConfigured() };
}
