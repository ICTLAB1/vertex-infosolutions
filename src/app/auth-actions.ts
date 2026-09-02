"use server";

import { revalidatePath } from "next/cache";
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
  sweepExpired,
  verifyOtp,
  verifyPassword,
} from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { appUrl } from "@/lib/stripe";

export type AuthError = { message: string; field?: string } | null;

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
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

  if (name.length < 2) return { message: "Enter your name.", field: "name" };
  if (!emailLooksValid(email)) {
    return { message: "Enter a valid email address.", field: "email" };
  }
  const weak = passwordProblem(password);
  if (weak) return { message: weak, field: "password" };

  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalisePhone(phoneRaw);
    if (!phone) {
      return {
        message:
          "Enter the number in international format, starting with the country code — +91 98765 43210.",
        field: "phone",
      };
    }
  }
  if (whatsappOptIn && !phone) {
    return {
      message: "Add a phone number to receive WhatsApp updates.",
      field: "phone",
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

  const user = await prisma.user.findUnique({ where: { email } });

  // One message for both failures, and the password is still hashed when the
  // account does not exist — otherwise the response time alone reveals which
  // addresses are registered.
  const ok = user
    ? await verifyPassword(password, user.passwordHash, user.passwordSalt)
    : await verifyPassword(password, "0".repeat(128), "decoy");

  if (!user || !ok) {
    return { message: "That email address and password do not match." };
  }

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

  if (name.length < 2) return { message: "Enter your name.", field: "name" };

  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalisePhone(phoneRaw);
    if (!phone) {
      return {
        message:
          "Enter the number in international format, starting with the country code.",
        field: "phone",
      };
    }
  }
  if (whatsappOptIn && !phone) {
    return {
      message: "Add a phone number to receive WhatsApp updates.",
      field: "phone",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, phone, whatsappOptIn: whatsappOptIn && Boolean(phone) },
  });

  revalidatePath("/account");
  return { message: "Saved." };
}
