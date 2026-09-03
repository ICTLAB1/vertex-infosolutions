import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  ATTEMPT_TTL_MINUTES,
  RESET_REQUEST_LIMITS,
  SIGN_IN_LIMITS,
  clearSignInFailures,
  recordResetRequest,
  recordSignInFailure,
  resetRequestLimit,
  signInLimit,
  sweepSignInAttempts,
} from "@/lib/rate-limit";

/**
 * Slowing down somebody guessing passwords.
 *
 * Three windows, because there are three different attacks. The one that needs
 * the most care is not the tightest — it is the loosest, because a limit keyed
 * on somebody else's address is a way to lock them out of their own account,
 * and these tests are where that trade-off is pinned down.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("the sign-in limit", () => {
  const stamp = Date.now();
  const email = () => `limit.${stamp}.${Math.random().toString(36).slice(2)}@example.test`;

  // Counted, not random. Two random addresses out of a small range collide
  // occasionally, and a test that fails one run in two hundred is worse than
  // no test — the first version of this flaked exactly that way.
  let nextCaller = 0;
  const ip = () => `203.0.113.${(nextCaller += 1)}`;

  afterEach(async () => {
    if (!hasDatabase) return;
    await prisma.authAttempt.deleteMany({
      where: { email: { contains: `limit.${stamp}.` } },
    });
  });

  const failTimes = async (times: number, address: string, caller: string) => {
    for (let index = 0; index < times; index += 1) {
      await recordSignInFailure(address, caller);
    }
  };

  it("lets an honest mistyper through", async () => {
    const address = email();
    const caller = ip();
    await failTimes(SIGN_IN_LIMITS.perPair - 1, address, caller);

    expect((await signInLimit(address, caller)).blocked).toBe(false);
  });

  it("holds off one caller working through one account", async () => {
    const address = email();
    const caller = ip();
    await failTimes(SIGN_IN_LIMITS.perPair, address, caller);

    const limit = await signInLimit(address, caller);
    expect(limit.blocked).toBe(true);
    expect(limit.retryAfterMinutes).toBe(SIGN_IN_LIMITS.windowMinutes);
  });

  /**
   * The reason the tightest counter is keyed on the pair and not the address
   * alone. A stranger who fails five times against somebody's account must not
   * thereby lock that person out of it.
   */
  it("does not let one caller lock a customer out from elsewhere", async () => {
    const address = email();
    const attacker = ip();
    const customer = ip();

    await failTimes(SIGN_IN_LIMITS.perPair, address, attacker);

    expect((await signInLimit(address, attacker)).blocked).toBe(true);
    expect((await signInLimit(address, customer)).blocked).toBe(false);
  });

  /** Password spraying: one caller, "Password123", every address it can find. */
  it("holds off one caller spraying many accounts", async () => {
    const caller = ip();
    for (let index = 0; index < SIGN_IN_LIMITS.perIp; index += 1) {
      await recordSignInFailure(email(), caller);
    }

    // A fresh address it has never tried, from the same caller.
    expect((await signInLimit(email(), caller)).blocked).toBe(true);
  });

  /**
   * A distributed attack on one account. Deliberately the loosest of the
   * three, because this is the counter an attacker could abuse to lock a
   * customer out — it takes twenty failures from several callers, and lasts
   * only the window.
   */
  it("holds off many callers working on one account", async () => {
    const address = email();
    for (let index = 0; index < SIGN_IN_LIMITS.perEmail; index += 1) {
      await recordSignInFailure(address, `198.51.100.${index + 1}`);
    }

    expect((await signInLimit(address, "198.51.100.99")).blocked).toBe(true);
  });

  it("forgets the failures once the password is right", async () => {
    const address = email();
    const caller = ip();
    await failTimes(SIGN_IN_LIMITS.perPair, address, caller);
    expect((await signInLimit(address, caller)).blocked).toBe(true);

    await clearSignInFailures(address);

    expect((await signInLimit(address, caller)).blocked).toBe(false);
  });

  /** The window slides: yesterday's failures are not held against anybody. */
  it("only counts failures inside the window", async () => {
    const address = email();
    const caller = ip();
    await failTimes(SIGN_IN_LIMITS.perPair, address, caller);

    const later = new Date(
      Date.now() + (SIGN_IN_LIMITS.windowMinutes + 1) * 60_000,
    );
    expect((await signInLimit(address, caller, later)).blocked).toBe(false);
  });

  /**
   * An address the edge could not identify is still counted — every such
   * caller together, which is the safe direction to err in.
   */
  it("counts unidentifiable callers as one", async () => {
    const address = email();
    await failTimes(SIGN_IN_LIMITS.perPair, address, "unknown");

    expect((await signInLimit(address, "unknown")).blocked).toBe(true);
  });

  /**
   * Kept for an hour, not forever. Long enough to be useful, short enough that
   * this is not a record of who signed in from where.
   */
  it("throws away attempts nothing will read again", async () => {
    const address = email();
    const caller = ip();
    await recordSignInFailure(address, caller);

    const wellLater = new Date(
      Date.now() + (ATTEMPT_TTL_MINUTES + 1) * 60_000,
    );
    await sweepSignInAttempts(wellLater);

    expect(
      await prisma.authAttempt.count({ where: { email: address } }),
    ).toBe(0);
  });

  it("keeps attempts the window still needs", async () => {
    const address = email();
    await recordSignInFailure(address, ip());

    await sweepSignInAttempts();

    expect(
      await prisma.authAttempt.count({ where: { email: address } }),
    ).toBe(1);
  });
});

/**
 * Asking for a password-reset code.
 *
 * A different problem from guessing a password, and the reason it needs its
 * own counter: the reset form answers identically whether or not the address
 * has an account — which is right — so nothing in the flow notices a script
 * walking an address list. Every hit that lands on a real customer sends them
 * an email they did not ask for, and `issueOtp`'s per-account limit cannot see
 * it, because from its side a thousand addresses each asked once.
 */
describe.skipIf(!hasDatabase)("asking for a reset code", () => {
  const stamp = Date.now();
  const ip = `198.51.100.${stamp % 200}`;

  afterEach(async () => {
    await prisma.authAttempt.deleteMany({ where: { kind: "PASSWORD_RESET" } });
  });

  it("lets an ordinary forgetful person through", async () => {
    for (let i = 0; i < RESET_REQUEST_LIMITS.perIp - 1; i += 1) {
      await recordResetRequest(`someone.${i}@example.test`, ip);
    }
    expect((await resetRequestLimit(ip)).blocked).toBe(false);
  });

  it("stops a caller working through an address list", async () => {
    for (let i = 0; i < RESET_REQUEST_LIMITS.perIp; i += 1) {
      await recordResetRequest(`victim.${i}@example.test`, ip);
    }
    expect((await resetRequestLimit(ip)).blocked).toBe(true);
  });

  it("does not let one caller shut the form for another", async () => {
    for (let i = 0; i < RESET_REQUEST_LIMITS.perIp; i += 1) {
      await recordResetRequest(`victim.${i}@example.test`, ip);
    }
    expect((await resetRequestLimit(`203.0.113.${stamp % 200}`)).blocked).toBe(
      false,
    );
  });

  it("never blocks callers the edge could not identify", async () => {
    // They all share the "unknown" bucket, so refusing them together would let
    // one script shut the form for everybody behind a proxy that sends no
    // header. The per-account limit inside issueOtp still holds for them.
    for (let i = 0; i < RESET_REQUEST_LIMITS.perIp * 3; i += 1) {
      await recordResetRequest(`someone.${i}@example.test`, "unknown");
    }
    expect((await resetRequestLimit("unknown")).blocked).toBe(false);
  });

  it("forgets a request once its window has passed", async () => {
    for (let i = 0; i < RESET_REQUEST_LIMITS.perIp; i += 1) {
      await recordResetRequest(`victim.${i}@example.test`, ip);
    }
    const later = new Date(
      Date.now() + (RESET_REQUEST_LIMITS.windowMinutes + 1) * 60_000,
    );
    expect((await resetRequestLimit(ip, later)).blocked).toBe(false);
  });

  it("keeps its counter apart from the sign-in one", async () => {
    // Somebody who mistyped their password four times is not also one reset
    // request away from being refused, and vice versa.
    for (let i = 0; i < RESET_REQUEST_LIMITS.perIp; i += 1) {
      await recordResetRequest(`victim.${i}@example.test`, ip);
    }
    const email = `sign.in.${stamp}@example.test`;
    expect((await signInLimit(email, ip)).blocked).toBe(false);
  });
});
