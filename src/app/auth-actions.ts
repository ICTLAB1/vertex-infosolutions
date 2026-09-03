"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSession,
  destroySession,
  emailLooksValid,
  getUser,
  hashPassword,
  issueOtp,
  normaliseEmail,
  OTP_TTL_TEXT,
  passwordProblem,
  resetPasswordWithCode,
  sweepExpired,
  verifyOtp,
  verifyPassword,
} from "@/lib/auth";
import { getCart } from "@/lib/cart";
import {
  clearSignInFailures,
  clientIp,
  recordResetRequest,
  recordSignInFailure,
  resetRequestLimit,
  signInLimit,
} from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { appUrl } from "@/lib/stripe";

export type AuthError = {
  message: string;
  field?: string;
  /**
   * What was typed, echoed back so a rejected form is not an empty one.
   *
   * React resets an uncontrolled form once its action returns, so without this
   * a mistyped password costs you your email address too — and on the register
   * form, your name, phone number and WhatsApp choice as well. Passwords are
   * never in here: retyping one after a failure is expected, and echoing it
   * would put it in the payload sent back to the browser.
   */
  values?: Record<string, string>;
} | null;

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** The named fields exactly as typed, for echoing back on a failure. */
function keep(form: FormData, ...names: string[]): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const name of names) {
    const value = form.get(name);
    if (typeof value === "string") kept[name] = value;
  }
  return kept;
}

/**
 * A phone number for WhatsApp has to be E.164 — a plus, a country code, and
 * digits. Anything looser and the Cloud API silently fails to deliver, which
 * is worse than refusing it here.
 */
function normalisePhone(raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  return /^\+[1-9]\d{7,14}$/.test(withPlus) ? withPlus : null;
}

/** Attach a guest basket to the account that just signed in. */
async function adoptCart(userId: string): Promise<void> {
  const cart = await getCart();
  if (!cart) return;
  await prisma.cart.updateMany({
    where: { id: cart.id, userId: null },
    data: { userId },
  });
}

export async function register(
  _previous: AuthError,
  form: FormData,
): Promise<AuthError> {
  const name = str(form, "name");
  const email = normaliseEmail(str(form, "email"));
  const password = str(form, "password");
  const phoneRaw = str(form, "phone");
  const whatsappOptIn = form.get("whatsappOptIn") === "on";
  const values = keep(form, "name", "email", "phone", "whatsappOptIn");

  if (name.length < 2) {
    return { message: "Enter your name.", field: "name", values };
  }
  if (!emailLooksValid(email)) {
    return { message: "Enter a valid email address.", field: "email", values };
  }
  const weak = passwordProblem(password);
  if (weak) return { message: weak, field: "password", values };

  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalisePhone(phoneRaw);
    if (!phone) {
      return {
        message:
          "Enter the number in international format, starting with the country code — +91 98765 43210.",
        field: "phone",
        values,
      };
    }
  }
  if (whatsappOptIn && !phone) {
    return {
      message: "Add a phone number to receive WhatsApp updates.",
      field: "phone",
      values,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Deliberately not "that email is already registered" as a hard error with
    // a different shape: this form is one of the few places an attacker can
    // enumerate accounts. The message is plain because the sign-in page is
    // right there, and hiding it would only frustrate the real owner.
    return {
      message: "There is already an account with that address. Sign in instead.",
      field: "email",
      values,
    };
  }

  const { hash, salt } = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      whatsappOptIn: whatsappOptIn && Boolean(phone),
      passwordHash: hash,
      passwordSalt: salt,
    },
  });

  const issued = await issueOtp(user.id, "VERIFY_EMAIL");
  if ("error" in issued) return { message: issued.error };

  await notify(
    "otp.verify",
    { userId: user.id, email: user.email },
    { name: user.name, code: issued.code, ttl: OTP_TTL_TEXT },
  );

  // Signed in immediately, but unverified — every page that matters checks
  // `emailVerifiedAt` rather than merely "is there a session".
  await createSession(user.id);
  await adoptCart(user.id);

  redirect("/verify");
}

export async function signIn(
  _previous: AuthError,
  form: FormData,
): Promise<AuthError> {
  const email = normaliseEmail(str(form, "email"));
  const password = str(form, "password");
  const next = str(form, "next");
  const values = keep(form, "email");

  const ip = clientIp(await headers());

  // Checked before the password is looked at, so a caller being held off does
  // not even get the timing signal of a hash being computed.
  const limit = await signInLimit(email, ip);
  if (limit.blocked) {
    return {
      message: `Too many sign-in attempts. Wait ${limit.retryAfterMinutes} minutes and try again, or reset your password.`,
      values,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // One message for both failures, and the password is still hashed when the
  // account does not exist — otherwise the response time alone reveals which
  // addresses are registered.
  const ok = user
    ? await verifyPassword(password, user.passwordHash, user.passwordSalt)
    : await verifyPassword(password, "0".repeat(128), "decoy");

  if (!user || !ok) {
    // Recorded against the address as submitted, whether or not it exists. If
    // only real accounts were counted, being told "too many attempts" would
    // answer the very question the message above refuses to.
    await recordSignInFailure(email, ip);
    return { message: "That email address and password do not match.", values };
  }

  // Right password: the failures before it were somebody forgetting, not
  // somebody guessing.
  await clearSignInFailures(email);

  await createSession(user.id);
  await adoptCart(user.id);
  await sweepExpired();

  if (!user.emailVerifiedAt) redirect("/verify");
  redirect(next && next.startsWith("/") ? next : "/account");
}

export async function signOut() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resendCode(): Promise<AuthError> {
  const user = await getUser();
  if (!user) redirect("/signin");
  if (user.emailVerifiedAt) redirect("/account");

  const issued = await issueOtp(user.id, "VERIFY_EMAIL");
  if ("error" in issued) return { message: issued.error };

  await notify(
    "otp.verify",
    { userId: user.id, email: user.email },
    { name: user.name, code: issued.code, ttl: OTP_TTL_TEXT },
  );
  return { message: "A new code is on its way." };
}

export async function confirmEmail(
  _previous: AuthError,
  form: FormData,
): Promise<AuthError> {
  const user = await getUser();
  if (!user) redirect("/signin");
  if (user.emailVerifiedAt) redirect("/account");

  const result = await verifyOtp(user.id, "VERIFY_EMAIL", str(form, "code"));
  if (!result.ok) return { message: result.error };

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });

  await notify(
    "account.welcome",
    { userId: user.id, email: user.email },
    { name: user.name, accountUrl: `${appUrl()}/account` },
  );

  revalidatePath("/", "layout");
  redirect("/account?welcome=1");
}

export async function updateProfile(
  _previous: AuthError,
  form: FormData,
): Promise<AuthError> {
  const user = await getUser();
  if (!user) redirect("/signin");

  const name = str(form, "name");
  const phoneRaw = str(form, "phone");
  const whatsappOptIn = form.get("whatsappOptIn") === "on";
  const values = keep(form, "name", "phone", "whatsappOptIn");

  if (name.length < 2) {
    return { message: "Enter your name.", field: "name", values };
  }

  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalisePhone(phoneRaw);
    if (!phone) {
      return {
        message:
          "Enter the number in international format, starting with the country code.",
        field: "phone",
        values,
      };
    }
  }
  if (whatsappOptIn && !phone) {
    return {
      message: "Add a phone number to receive WhatsApp updates.",
      field: "phone",
      values,
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, phone, whatsappOptIn: whatsappOptIn && Boolean(phone) },
  });

  revalidatePath("/account");
  return { message: "Saved." };
}

// ---------------------------------------------------------------------------
// Forgotten passwords
// ---------------------------------------------------------------------------

/**
 * Step one: ask for a code.
 *
 * Whether or not the address has an account, the answer is identical and so is
 * the next page. Anything else turns this form into a way to ask "does this
 * company buy software here?" — commercially interesting to a competitor, and
 * nobody's business but the customer's.
 */
export async function requestPasswordReset(
  _previous: AuthError,
  form: FormData,
): Promise<AuthError> {
  const email = normaliseEmail(str(form, "email"));
  const values = keep(form, "email");
  if (!emailLooksValid(email)) {
    return { message: "Enter a valid email address.", field: "email", values };
  }

  const limited = await guardResetRequest(email);
  if (limited) return { ...limited, values };

  await sendResetCode(email);
  redirect(`/reset?email=${encodeURIComponent(email)}`);
}

/** Step one again, from the page where the code is entered. */
export async function resendResetCode(email: string): Promise<AuthError> {
  const clean = normaliseEmail(email);
  if (!emailLooksValid(clean)) {
    return { message: "Enter a valid email address." };
  }

  const limited = await guardResetRequest(clean);
  if (limited) return limited;

  await sendResetCode(clean);
  return { message: "If that address has an account, another code is on its way." };
}

/**
 * Whether this caller has asked for enough reset codes.
 *
 * The request is recorded before the account is looked up and whatever the
 * lookup finds, so the counter cannot become the answer to "does this address
 * have an account?" — the question the identical responses above exist to
 * refuse. Returns the refusal to show, or null to go ahead.
 */
async function guardResetRequest(email: string): Promise<AuthError | null> {
  const ip = clientIp(await headers());
  const limit = await resetRequestLimit(ip);
  if (limit.blocked) {
    return {
      message: `That is a lot of reset codes from one place. Try again in ${limit.retryAfterMinutes} minutes, or email us if you are genuinely locked out.`,
    };
  }
  await recordResetRequest(email, ip);
  return null;
}

/**
 * Issue and send, or quietly do nothing.
 *
 * Errors are swallowed on purpose. `issueOtp` refuses after five codes in an
 * hour, and surfacing that refusal would answer the enumeration question the
 * rest of this flow is careful not to: only a real account can be rate
 * limited. The cost is that somebody who has genuinely hit the limit waits for
 * an email that is not coming; the server log says why.
 */
async function sendResetCode(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const issued = await issueOtp(user.id, "PASSWORD_RESET");
  if ("error" in issued) {
    console.warn(`[auth] reset code not issued for ${user.id}: ${issued.error}`);
    return;
  }

  await notify(
    "otp.reset",
    { userId: user.id, email: user.email },
    { name: user.name, code: issued.code, ttl: OTP_TTL_TEXT },
  );
}

/** Step two: prove possession of the mailbox, then choose a new password. */
export async function resetPassword(
  _previous: AuthError,
  form: FormData,
): Promise<AuthError> {
  // The code is echoed back as well as the address: a password that is too
  // short must not cost the customer the code they just went to their inbox
  // for.
  const values = keep(form, "email", "code");

  const result = await resetPasswordWithCode(
    str(form, "email"),
    str(form, "code"),
    str(form, "password"),
  );
  if (!result.ok) return { message: result.error, field: result.field, values };

  // Every session was just deleted, including this browser's. A new one is
  // issued here so the customer lands signed in rather than at the sign-in
  // page they have just proved they do not need.
  await createSession(result.userId);
  await adoptCart(result.userId);

  revalidatePath("/", "layout");
  redirect("/account");
}
