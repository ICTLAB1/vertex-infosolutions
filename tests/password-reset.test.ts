import { afterAll, describe, expect, it } from "vitest";

import {
  hashPassword,
  issueOtp,
  resetPasswordWithCode,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Forgotten passwords.
 *
 * The reset path is the one place where possession of a mailbox is enough to
 * take over an account, so the guarantees are worth stating and worth testing:
 * a code works once, a failure changes nothing, and a success ends every
 * session that existed before it — because people reset a password precisely
 * when they think somebody else has it.
 *
 * These need a database, so they skip when DATABASE_URL is unset.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const OLD = "the-old-password-1";
const NEW = "a-brand-new-password";

describe.skipIf(!hasDatabase)("resetPasswordWithCode", () => {
  const made: string[] = [];

  afterAll(async () => {
    if (!hasDatabase) return;
    await prisma.user.deleteMany({ where: { id: { in: made } } });
    await prisma.$disconnect();
  });

  /** An account with a known password and two live sessions. */
  async function account(options: { verified?: boolean } = {}) {
    const { verified = true } = options;
    const { hash, salt } = await hashPassword(OLD);
    const user = await prisma.user.create({
      data: {
        email: `reset.${Math.random().toString(36).slice(2)}@example.test`,
        name: "Reset Test",
        passwordHash: hash,
        passwordSalt: salt,
        emailVerifiedAt: verified ? new Date() : null,
      },
    });
    made.push(user.id);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.session.createMany({
      data: [
        { userId: user.id, tokenHash: `t-${user.id}-1`, expiresAt: tomorrow },
        { userId: user.id, tokenHash: `t-${user.id}-2`, expiresAt: tomorrow },
      ],
    });

    return user;
  }

  async function codeFor(userId: string) {
    const issued = await issueOtp(userId, "PASSWORD_RESET");
    if ("error" in issued) throw new Error(issued.error);
    return issued.code;
  }

  const reload = (id: string) =>
    prisma.user.findUniqueOrThrow({ where: { id } });

  it("sets the new password and retires the old one", async () => {
    const user = await account();
    const code = await codeFor(user.id);

    const result = await resetPasswordWithCode(user.email, code, NEW);
    expect(result).toEqual({ ok: true, userId: user.id });

    const after = await reload(user.id);
    expect(await verifyPassword(NEW, after.passwordHash, after.passwordSalt)).toBe(true);
    expect(await verifyPassword(OLD, after.passwordHash, after.passwordSalt)).toBe(false);
  });

  /**
   * The point of the whole feature. Somebody who reset their password because
   * an intruder had it must not find the intruder still signed in.
   */
  it("signs out every session that existed before it", async () => {
    const user = await account();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);

    await resetPasswordWithCode(user.email, await codeFor(user.id), NEW);

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("tells the customer their password changed", async () => {
    const user = await account();
    await resetPasswordWithCode(user.email, await codeFor(user.id), NEW);

    const sent = await prisma.notification.findMany({
      where: { userId: user.id, template: "account.password-changed" },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].channel).toBe("EMAIL");
    // Never over WhatsApp: the notice belongs in the mailbox, beside the code
    // it answers.
    const wa = await prisma.notification.count({
      where: { userId: user.id, channel: "WHATSAPP" },
    });
    expect(wa).toBe(0);
  });

  it("burns the code — a second use of it fails", async () => {
    const user = await account();
    const code = await codeFor(user.id);

    expect((await resetPasswordWithCode(user.email, code, NEW)).ok).toBe(true);

    const replay = await resetPasswordWithCode(user.email, code, "another-password-x");
    expect(replay.ok).toBe(false);

    // And the password is still the one the first reset set.
    const after = await reload(user.id);
    expect(await verifyPassword(NEW, after.passwordHash, after.passwordSalt)).toBe(true);
  });

  /**
   * Two tabs, or a double-submitted form. Only one may take.
   */
  it("lets exactly one of two simultaneous uses through", async () => {
    const user = await account();
    const code = await codeFor(user.id);

    const results = await Promise.all([
      resetPasswordWithCode(user.email, code, NEW),
      resetPasswordWithCode(user.email, code, NEW),
      resetPasswordWithCode(user.email, code, NEW),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("refuses a wrong code and leaves the password alone", async () => {
    const user = await account();
    const code = await codeFor(user.id);
    const wrong = code === "000000" ? "111111" : "000000";

    const result = await resetPasswordWithCode(user.email, wrong, NEW);
    expect(result.ok).toBe(false);

    const after = await reload(user.id);
    expect(await verifyPassword(OLD, after.passwordHash, after.passwordSalt)).toBe(true);
    // The sessions survive a failed attempt — a stranger guessing codes must
    // not be able to sign the real owner out.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
  });

  /**
   * The short password is caught before the code is looked at, so somebody who
   * fumbles the password field still has their code.
   */
  it("does not burn the code on a password that is too short", async () => {
    const user = await account();
    const code = await codeFor(user.id);

    const rejected = await resetPasswordWithCode(user.email, code, "short");
    expect(rejected.ok).toBe(false);
    expect(rejected.ok === false && rejected.field).toBe("password");

    expect((await resetPasswordWithCode(user.email, code, NEW)).ok).toBe(true);
  });

  /**
   * An address nobody has an account for must be indistinguishable from a
   * wrong code, or the form becomes a way to ask who buys software here.
   */
  it("answers an unknown address exactly as it answers a wrong code", async () => {
    const user = await account();
    const code = await codeFor(user.id);
    const wrong = code === "000000" ? "111111" : "000000";

    const unknown = await resetPasswordWithCode(
      "nobody.at.all@example.test",
      code,
      NEW,
    );
    const badCode = await resetPasswordWithCode(user.email, wrong, NEW);

    expect(unknown).toEqual(badCode);
  });

  /**
   * Reading the code proves control of the mailbox, which is the same thing
   * the verification code proves.
   */
  it("verifies an account that never confirmed its email", async () => {
    const user = await account({ verified: false });
    expect(user.emailVerifiedAt).toBeNull();

    await resetPasswordWithCode(user.email, await codeFor(user.id), NEW);

    expect((await reload(user.id)).emailVerifiedAt).not.toBeNull();
  });

  it("does not care how the address was typed", async () => {
    const user = await account();
    const code = await codeFor(user.id);

    const result = await resetPasswordWithCode(
      `  ${user.email.toUpperCase()}  `,
      code,
      NEW,
    );
    expect(result.ok).toBe(true);
  });
});
