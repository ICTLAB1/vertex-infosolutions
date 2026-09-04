import "server-only";

import { EmailClient } from "@azure/communication-email";

import { prisma } from "@/lib/db";
import { invoiceAttachment } from "@/lib/invoice";
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

/**
 * Messages that may not be sent anywhere but the address on the account.
 *
 * Each of these carries something that *is* the credential — a licence key, a
 * one-time code — so "send it to this other address instead" is the whole of
 * an attack rather than a convenience. An administrator can redirect a
 * confirmation or a reminder that bounced; changing where a key goes is an
 * account change, made by the customer, after proving the new address.
 */
export const CREDENTIAL_TEMPLATES: readonly NotifyTemplate[] = [
  "otp.verify",
  "otp.signin",
  "otp.reset",
  "order.keys",
  "account.password-changed",
] as const;

export type NotifyTemplate =
  | "otp.verify"
  | "otp.signin"
  | "otp.reset"
  | "account.welcome"
  | "account.password-changed"
  | "order.paid"
  | "order.keys"
  | "order.pending"
  | "licence.expiring"
  | "enquiry.received"
  | "enquiry.acknowledged";

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
  return Boolean(process.env.ACS_CONNECTION_STRING && process.env.EMAIL_FROM);
}

function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

/**
 * Send an email.
 *
 * Azure Communication Services, over its own SDK rather than SMTP: there is no
 * connection pool to manage from a container that may be scaled to zero, and
 * the sending domain lives in the same subscription as everything else here.
 * Swapping it for SES, Resend or SMTP means changing this function and nothing
 * else.
 *
 * Two settings decide whether any of it happens, and both are needed:
 * `ACS_CONNECTION_STRING` and `EMAIL_FROM`. They are read from the environment
 * at the moment of sending, which is to say from the process as it was
 * started — a setting added to the web app after it booted does not reach a
 * running container until it restarts. That has caught us out: mail settings
 * were added, nothing was sent, and everything looked correctly configured
 * from the outside.
 */
export type MailAttachment = { filename: string; content: string };

let client: EmailClient | undefined;

function emailClient(): EmailClient {
  client ??= new EmailClient(process.env.ACS_CONNECTION_STRING!);
  return client;
}

/**
 * Azure wants a bare address where Resend accepted "Name <address>".
 *
 * Both forms are allowed in EMAIL_FROM because that is what somebody will
 * type, and the display name a recipient sees comes from the sender username
 * configured on the domain in Azure rather than from this string.
 */
function senderAddress(from: string): string {
  const bracketed = from.match(/<([^>]+)>/);
  return (bracketed ? bracketed[1] : from).trim();
}


/**
 * The send itself, exposed so the back office can test it.
 *
 * Deliberately not routed through `notify`: this writes no outbox row, has no
 * recipient to look up and no template to compose. It is the one message whose
 * only purpose is to find out whether sending works at all.
 */
export async function sendRaw(
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: true; ref: string | null } | { ok: false; error: string }> {
  return sendEmail(to, subject, body);
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  attachments: MailAttachment[] = [],
): Promise<{ ok: true; ref: string | null } | { ok: false; error: string }> {
  if (!emailConfigured()) {
    return { ok: false, error: "Email provider not configured" };
  }

  try {
    const poller = await emailClient().beginSend({
      senderAddress: senderAddress(process.env.EMAIL_FROM!),
      content: { subject, plainText: body },
      recipients: { to: [{ address: to }] },
      ...(attachments.length > 0
        ? {
            attachments: attachments.map((attachment) => ({
              name: attachment.filename,
              // Azure requires a MIME type. Only invoices are attached today,
              // but deriving it from the name keeps the next attachment from
              // arriving mislabelled as a PDF.
              contentType: attachment.filename.toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : "application/octet-stream",
              contentInBase64: attachment.content,
            })),
          }
        : {}),
    });

    // Deliberately not polled to completion. `beginSend` has already made the
    // request, so a rejected key, an unverified sender or a malformed address
    // has thrown by now and is recorded as a failure. What remains is Azure
    // delivering it, which takes seconds to minutes — and a customer waiting
    // on a page must not wait for that. The outbox sweep is what chases a
    // delivery that never happens.
    const state = poller.getOperationState() as { id?: string };
    return { ok: true, ref: state.id ?? null };
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

export async function compose(
  template: NotifyTemplate,
  data: Record<string, string>,
): Promise<Message> {
  const config = await getSiteConfig();
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

    case "otp.reset":
      return {
        subject: `${data.code} is your ${brand} password reset code`,
        body: [
          `Hello ${data.name},`,
          "",
          `Your password reset code is ${data.code}. It expires in ${data.ttl}.`,
          "",
          "Entering it lets you choose a new password. Until you do, your current password still works and nothing about your account has changed.",
          "",
          `If you did not ask for this, somebody typed your address into our reset form. That on its own gives them nothing — but if it keeps happening, tell us at ${support}.`,
          "",
          `— ${brand}`,
        ].join("\n"),
        // Never over WhatsApp. This code is the whole of what stands between a
        // chat thread and somebody else's account.
      };

    case "account.password-changed":
      return {
        subject: `Your ${brand} password was changed`,
        body: [
          `Hello ${data.name},`,
          "",
          `The password on your account was changed on ${data.when}, and everywhere that was signed in has been signed out.`,
          "",
          "If that was you, there is nothing to do.",
          "",
          `If it was not, your email address has been compromised as well as the account — change that password first, then tell us at ${support} straight away. Do not reset this account again until you have.`,
          "",
          `— ${brand}`,
        ].join("\n"),
        // Never over WhatsApp: this is the record, and it belongs in the
        // mailbox alongside the reset code it answers.
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
          `Your licence details will be in your account within one business day: ${data.orderUrl}`,
          "",
          "You will get a second email the moment they are ready. Microsoft subscriptions arrive as the sign-in details for a new tenant rather than as a key.",
          "",
          `Your ${data.invoiceKind} is attached to this email as a PDF, and is on the order page if you need it again: ${data.invoiceUrl}`,
          "",
          "Keep a copy. If a publisher ever needs to confirm the licence is yours, the invoice is what proves it.",
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

    // To us, not to the customer. The one message in this file whose reader is
    // the shop rather than the person who wrote it.
    case "enquiry.received":
      return {
        subject: `${data.kindLabel} from ${data.name}${data.company ? ` (${data.company})` : ""}`,
        body: [
          `${data.kindLabel} received.`,
          "",
          `From:    ${data.name} <${data.email}>`,
          // Only the optional rows are dropped when empty. Filtering the whole
          // list would take the blank separators with it and run the header
          // into the message.
          ...[
            data.company ? `Company: ${data.company}` : "",
            data.phone ? `Phone:   ${data.phone}` : "",
            data.market ? `Market:  ${data.market}` : "",
            data.productSlug ? `About:   ${data.productSlug}` : "",
          ].filter(Boolean),
          "",
          data.message,
          "",
          `Reply to them directly at ${data.email}, and mark it dealt with at ${data.adminUrl}`,
        ].join("\n"),
      };

    // To the customer, so a question does not vanish into silence.
    case "enquiry.acknowledged":
      return {
        subject: `We have your ${data.kindLabel.toLowerCase()}`,
        body: [
          `Hello ${data.name},`,
          "",
          "Thank you — your message reached us and a person will read it. We answer within one business day.",
          "",
          "What you sent:",
          "",
          data.message,
          "",
          `If you need to add anything, reply to this email rather than sending it again — it comes to the same place.`,
          "",
          `— ${brand}`,
        ].join("\n"),
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
          // Absent when bank transfer is not configured, so this email never
          // asks somebody to pay into nothing.
          ...(data.bankDetails
            ? ["Where to send it:", "", data.bankDetails, ""]
            : []),
          "Your licence is issued within one business day of the funds clearing, and you will get another email then.",
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
  const message = await compose(template, data);

  const emailRow = await prisma.notification.create({
    data: {
      userId: recipient.userId ?? null,
      orderId: recipient.orderId ?? null,
      channel: "EMAIL",
      destination: recipient.email,
      template,
      subject: message.subject,
      body: message.body,
      // Stamped at creation, before the send is even attempted, so a process
      // that dies mid-flight leaves a row the retry sweep can recognise as
      // stale rather than one it must guess about.
      lastAttemptAt: new Date(),
    },
  });

  const emailResult = await sendEmail(
    recipient.email,
    message.subject,
    message.body,
    await attachmentsFor(template, recipient.orderId),
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
      lastAttemptAt: new Date(),
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
 * The raw senders, for the retry sweep.
 *
 * `notify` is the way to send something new: it composes the message and
 * writes the outbox row. A retry has both of those already and needs only the
 * provider call, so it reaches for these — and gets exactly the same code path
 * the first attempt used, which is the point.
 */
export const deliver = { email: sendEmail, whatsapp: sendWhatsApp };

/**
 * The files a message carries, worked out from the message rather than stored.
 *
 * A confirmation email carries the invoice, because that is the document the
 * customer's finance team files and an auditor asks for years later, and a
 * link in an email is not a document — it is a link that needs an account, a
 * password, and the store still being there.
 *
 * Derived on every send, never written to the outbox. That keeps a row small
 * enough to be worth keeping forever, and it means a retry days later attaches
 * the same document rather than a stale copy of one. A failure to render is
 * swallowed: a confirmation that arrives without its invoice is worth far more
 * than no confirmation at all.
 */
export async function attachmentsFor(
  template: NotifyTemplate,
  orderId: string | null | undefined,
): Promise<MailAttachment[]> {
  if (template !== "order.paid" || !orderId) return [];
  try {
    const invoice = await invoiceAttachment(orderId);
    return invoice ? [invoice] : [];
  } catch (error) {
    console.error(`[notify] could not render the invoice for ${orderId}`, error);
    return [];
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

/**
 * Whether the last message of this kind actually left the building.
 *
 * The verify page used to say "we sent a six-digit code to you" whatever
 * happened, because it had no way of knowing. With no mail provider configured
 * — which is exactly what a half-finished deployment looks like — that
 * sentence is untrue, the customer waits for an email that was never sent, and
 * nothing anywhere says so. They cannot buy anything until they are verified,
 * so this is not a cosmetic failure: it is the shop quietly refusing every new
 * customer.
 *
 * Read from the outbox rather than from the configuration, so it reports what
 * happened to this person's message rather than what ought to happen in
 * general. A provider that is configured and rejecting mail is the same
 * problem to the customer and is caught the same way.
 */
export async function lastDeliveryFailed(
  userId: string,
  template: NotifyTemplate,
): Promise<string | null> {
  const row = await prisma.notification.findFirst({
    where: { userId, template, channel: "EMAIL" },
    orderBy: { createdAt: "desc" },
    select: { status: true, error: true },
  });
  if (!row || row.status !== "FAILED") return null;
  return row.error ?? "The message could not be sent.";
}
