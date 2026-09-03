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

import type { OtpPurpose } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sweepSignInAttempts } from "@/lib/rate-limit";

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
  // Failed sign-ins are kept for an hour and no longer: long enough to slow an
  // attack down, short enough not to become a record of who signed in from
  // where.
  await sweepSignInAttempts(now);
}

// ---------------------------------------------------------------------------
// One-time codes
// ---------------------------------------------------------------------------

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
/** No more than this many codes per address in the window, to stop mail-bombing. */
const OTP_MAX_PER_HOUR = 5;

/**
 * Taken from the schema rather than restated here. A hand-written union drifts
 * the moment a purpose is added, and drifts silently.
 */
export type { OtpPurpose } from "@/generated/prisma/enums";

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

  // Consumed with a conditional update, so a code cannot be replayed even if
  // two requests arrive carrying it at the same instant: the database
  // serialises them and the loser matches zero rows. An unconditional update
  // would let both through, which for a password reset means two people
  // holding one code both getting in.
  const consumed = await prisma.emailOtp.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) {
    return { ok: false, error: "That code has already been used. Request a new one." };
  }
  return { ok: true };
}

/**
 * Change a password on the strength of a one-time code.
 *
 * The session cookie and the redirect belong to the server action; everything
 * that decides whether the change is safe lives here, where it can be tested
 * without a request.
 *
 * Order matters. The password is checked for shape *before* the code is
 * verified, so a password that is too short does not burn a code the customer
 * then has to request again. And every existing session is deleted after the
 * change: people reset a password because they believe somebody else has it,
 * and a reset that leaves the intruder signed in is not a reset.
 */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  password: string,
): Promise<
  { ok: true; userId: string } | { ok: false; error: string; field?: string }
> {
  const weak = passwordProblem(password);
  if (weak) return { ok: false, error: weak, field: "password" };

  const user = await prisma.user.findUnique({
    where: { email: normaliseEmail(email) },
  });

  /**
   * One message for every way this can fail: no such account, wrong code,
   * expired code, out of attempts, already used.
   *
   * `verifyOtp`'s own messages are more helpful — "4 attempts left" tells a
   * signed-in customer exactly where they stand on /verify. Here they would
   * also tell a stranger that the address has an account with a live code
   * against it, which is the question this whole flow refuses to answer. So
   * they are collapsed, and the part that matters to somebody who is stuck —
   * ask for a new one — survives.
   */
  const REFUSED = {
    ok: false as const,
    error: "That code is not right, or it has expired. Ask for a new one.",
    field: "code",
  };

  if (!user) return REFUSED;

  const checked = await verifyOtp(user.id, "PASSWORD_RESET", code);
  if (!checked.ok) return REFUSED;

  const { hash, salt } = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hash,
      passwordSalt: salt,
      // Reading the code proves control of the mailbox, which is the same
      // thing the verification code proves. An account that never got round
      // to confirming is confirmed by this.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });

  await prisma.session.deleteMany({ where: { userId: user.id } });

  await notify(
    "account.password-changed",
    { userId: user.id, email: user.email },
    {
      name: user.name,
      when: `${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`,
    },
  );

  return { ok: true, userId: user.id };
}
