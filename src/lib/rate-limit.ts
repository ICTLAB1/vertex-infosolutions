import "server-only";

import { prisma } from "@/lib/db";

/**
 * Slowing down somebody guessing passwords.
 *
 * Until this, sign-in had no limit of any kind: a script could work through a
 * password list against one account, or through an address list with
 * "Password123", as fast as the server would answer. scrypt makes each guess
 * expensive, which helps, but expensive is not the same as limited.
 *
 * Three windows, because there are three different attacks and one counter
 * cannot answer all of them:
 *
 * **One person, one account** — the ordinary case, and the one worth stopping
 * hardest. Counted on the address *and* the caller together, so a stranger
 * cannot lock a customer out of their own account by failing five times: their
 * failures are counted against their address pairing, not the customer's.
 *
 * **One person, many accounts** — password spraying. Counted on the caller
 * alone, generously, because a shared office or a mobile carrier's NAT puts
 * real people behind one address.
 *
 * **Many people, one account** — a distributed attack on somebody specific.
 * Counted on the address alone, and deliberately the loosest of the three:
 * this is the one an attacker could abuse to lock a customer out, so it takes
 * twenty failures from several callers and lasts fifteen minutes.
 *
 * A limit that can be waited out in fifteen minutes sounds weak. It is not:
 * against a six-character password it turns hours into years, and the accounts
 * that matter are protected by the twelve-character minimum as well.
 */

export const SIGN_IN_LIMITS = {
  /** This caller, this address. */
  perPair: 5,
  /** This caller, any address. */
  perIp: 50,
  /** This address, any caller. */
  perEmail: 20,
  windowMinutes: 15,
} as const;

/** How long a failed attempt is kept. Nothing needs it after the window. */
export const ATTEMPT_TTL_MINUTES = 60;

/**
 * The caller's address, as far as anything can tell.
 *
 * **This is only as trustworthy as what sits in front of the app.** Every one
 * of these headers is just a header: a caller reaching the container directly
 * can put whatever it likes in them and rotate it per request, which defeats
 * the two caller-based limits entirely. The address-based limit is what still
 * holds in that case, and it is why there is one.
 *
 * So: terminate at Front Door, Cloudflare or an equivalent that overwrites
 * these on the way through, and do not expose the container's own hostname.
 * `CLIENT_IP_HEADER` pins the one header your edge actually sets, which is
 * better than any guess this list makes.
 *
 * `x-forwarded-for` is read last and from the *right*, because each hop
 * appends: the rightmost entry was observed by the nearest proxy, while the
 * leftmost is whatever the original caller claimed.
 */
export function clientIp(headers: Headers): string {
  const direct = [
    process.env.CLIENT_IP_HEADER,
    "cf-connecting-ip", // Cloudflare
    "true-client-ip", // Cloudflare Enterprise, Akamai
    "x-azure-clientip", // Azure Front Door
    "x-client-ip",
  ].filter((name): name is string => Boolean(name));

  for (const name of direct) {
    const value = clean(headers.get(name));
    if (value) return value;
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    for (let index = hops.length - 1; index >= 0; index -= 1) {
      const value = clean(hops[index]);
      if (value) return value;
    }
  }

  // Better to say so than to invent one: "unknown" is a bucket like any other,
  // so callers the edge cannot identify are still limited — together.
  return "unknown";
}

/** Strip the port App Service appends, and the brackets IPv6 arrives in. */
function clean(raw: string | null | undefined): string | null {
  let value = raw?.trim();
  if (!value) return null;

  if (value.startsWith("[")) {
    // [2001:db8::1]:443
    value = value.slice(1, value.indexOf("]") > 0 ? value.indexOf("]") : undefined);
  } else if (value.split(":").length === 2) {
    // 203.0.113.7:52190 — a bare IPv6 has more colons than this and no port.
    value = value.split(":")[0];
  }

  value = value.trim();
  return value && value.length <= 45 ? value : null;
}

export type SignInLimit = { blocked: boolean; retryAfterMinutes: number };

/**
 * Whether this attempt may go ahead.
 *
 * Read before the password is checked, so a blocked caller does not even get
 * the timing signal of a hash being computed.
 */
export async function signInLimit(
  email: string,
  ip: string,
  now: Date = new Date(),
): Promise<SignInLimit> {
  const since = new Date(now.getTime() - SIGN_IN_LIMITS.windowMinutes * 60_000);

  const [pair, fromIp, forEmail] = await Promise.all([
    prisma.signInAttempt.count({ where: { email, ip, createdAt: { gt: since } } }),
    prisma.signInAttempt.count({ where: { ip, createdAt: { gt: since } } }),
    prisma.signInAttempt.count({ where: { email, createdAt: { gt: since } } }),
  ]);

  const blocked =
    pair >= SIGN_IN_LIMITS.perPair ||
    fromIp >= SIGN_IN_LIMITS.perIp ||
    forEmail >= SIGN_IN_LIMITS.perEmail;

  return { blocked, retryAfterMinutes: SIGN_IN_LIMITS.windowMinutes };
}

export async function recordSignInFailure(
  email: string,
  ip: string,
): Promise<void> {
  await prisma.signInAttempt.create({ data: { email, ip } });
}

/**
 * Forget an address's failures.
 *
 * Called on a successful sign-in: somebody who mistyped their password four
 * times and then got it right is not one attempt away from being locked out
 * for the rest of the quarter hour.
 */
export async function clearSignInFailures(email: string): Promise<void> {
  await prisma.signInAttempt.deleteMany({ where: { email } });
}

/** Drop attempts nothing will read again. Called by the existing sweep. */
export async function sweepSignInAttempts(now: Date = new Date()): Promise<void> {
  await prisma.signInAttempt.deleteMany({
    where: {
      createdAt: { lt: new Date(now.getTime() - ATTEMPT_TTL_MINUTES * 60_000) },
    },
  });
}
