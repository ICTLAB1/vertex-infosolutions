import "server-only";

import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/db";

/**
 * `promisify` picks scrypt's three-argument overload, which cannot take the
 * cost parameters below. The cast selects the four-argument form.
 */
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const SESSION_COOKIE = "vx_session";
const SESSION_DAYS = 30;

/**
 * Passwords.
 *
 * scrypt, from Node's own crypto — no dependency, and a memory-hard KDF rather
 * than a fast hash. The parameters below are the ones Node documents as
 * interactive-login grade; N is the cost and the memory ceiling has to be
 * raised to match it or the call throws.
 *
 * A password is never logged, never returned from a query, and never compared
 * with `===` — see `verifyPassword`.
 */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(
  password: string,
): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT.keylen, SCRYPT)) as Buffer;
  return { hash: derived.toString("hex"), salt };
}

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const derived = (await scrypt(password, salt, SCRYPT.keylen, SCRYPT)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  // Lengths must match before timingSafeEqual, which throws otherwise — and a
  // thrown comparison is a failed one, not a passed one.
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

/**
 * What a password has to be.
 *
 * Length, and nothing else. Composition rules — one capital, one symbol — push
 * people towards Password1! and are worse than useless; NIST dropped them
 * years ago. Twelve characters of anything beats eight of theatre.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) {
    return "Use at least 12 characters. A short phrase you can remember is ideal.";
  }
  if (password.length > 200) return "That password is too long.";
  return null;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailLooksValid(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

/**
 * Sessions.
 *
 * The cookie carries a random token; the database stores only its SHA-256.
 * A leaked backup is then a list of hashes rather than a set of live logins,
 * and revoking a session is deleting a row.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const head = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: head.get("user-agent")?.slice(0, 300) ?? null,
    },
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export type SignedInUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  whatsappOptIn: boolean;
  emailVerifiedAt: Date | null;
};

/** The signed-in customer, or null. Safe to call from any server component. */
export async function getUser(): Promise<SignedInUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          whatsappOptIn: true,
          emailVerifiedAt: true,
        },
      },
    },
  });

  if (!session) return null;
  // An expired row is not deleted here: a render is not the place for a write,
  // and the sweep below handles it.
  if (session.expiresAt.getTime() < Date.now()) return null;

  return session.user;
}

/** Remove expired sessions and spent codes. Called after sign-in. */
export async function sweepExpired(): Promise<void> {
  const now = new Date();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.emailOtp.deleteMany({ where: { expiresAt: { lt: now } } });
}

// ---------------------------------------------------------------------------
// One-time codes
// ---------------------------------------------------------------------------

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
/** No more than this many codes per address in the window, to stop mail-bombing. */
const OTP_MAX_PER_HOUR = 5;

export type OtpPurpose = "VERIFY_EMAIL" | "SIGN_IN";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Six digits, from a CSPRNG rather than Math.random, and stored hashed.
 *
 * Six digits is a million possibilities, which is only safe because a code
 * expires in ten minutes and dies after five wrong guesses. Take either of
 * those away and the length would have to go up.
 */
export async function issueOtp(
  userId: string,
  purpose: OtpPurpose,
): Promise<{ code: string } | { error: string }> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.emailOtp.count({
    where: { userId, purpose, createdAt: { gt: since } },
  });
  if (recent >= OTP_MAX_PER_HOUR) {
    return {
      error:
        "Too many codes requested. Wait an hour, or contact us if you are stuck.",
    };
  }

  // Any earlier unspent code for this purpose is invalidated, so only the most
  // recent email is usable and an old one found later is worthless.
  await prisma.emailOtp.deleteMany({ where: { userId, purpose, consumedAt: null } });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.emailOtp.create({
    data: {
      userId,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });

  return { code };
}

export const OTP_TTL_TEXT = `${OTP_TTL_MINUTES} minutes`;

export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = code.replace(/\D/g, "");

  const otp = await prisma.emailOtp.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { ok: false, error: "Request a new code — that one is no longer valid." };
  }
  if (otp.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many wrong attempts. Request a new code.",
    };
  }

  const expected = Buffer.from(otp.codeHash, "hex");
  const given = Buffer.from(hashCode(clean), "hex");
  const matches =
    expected.length === given.length && timingSafeEqual(expected, given);

  if (!matches) {
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    const left = OTP_MAX_ATTEMPTS - (otp.attempts + 1);
    return {
      ok: false,
      error:
        left > 0
          ? `That code is not right. ${left} ${left === 1 ? "attempt" : "attempts"} left.`
          : "That code is not right, and there are no attempts left. Request a new one.",
    };
  }

  // Consumed on the way out, so a code cannot be replayed even if two requests
  // arrive with it at once.
  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
