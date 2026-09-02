import { describe, expect, it } from "vitest";

import {
  emailLooksValid,
  hashPassword,
  normaliseEmail,
  passwordProblem,
  verifyPassword,
} from "@/lib/auth";

describe("passwords", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const { hash, salt } = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash, salt)).toBe(true);
    expect(await verifyPassword("Correct horse battery staple", hash, salt)).toBe(false);
    expect(await verifyPassword("", hash, salt)).toBe(false);
  });

  it("salts, so the same password hashes differently for two accounts", async () => {
    const a = await hashPassword("the same passphrase");
    const b = await hashPassword("the same passphrase");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // And neither salt unlocks the other's hash.
    expect(await verifyPassword("the same passphrase", a.hash, b.salt)).toBe(false);
  });

  it("returns false rather than throwing on a malformed stored hash", async () => {
    // timingSafeEqual throws on a length mismatch, and a thrown comparison
    // must be a failed one — never an accidental pass.
    expect(await verifyPassword("anything", "abcd", "salt")).toBe(false);
    expect(await verifyPassword("anything", "", "salt")).toBe(false);
  });

  it("asks for length and nothing else", () => {
    // Composition rules push people towards Password1! and NIST dropped them.
    expect(passwordProblem("short")).toBeTruthy();
    expect(passwordProblem("elevenchars")).toBeTruthy();
    expect(passwordProblem("twelvechars!")).toBeNull();
    expect(passwordProblem("a perfectly ordinary passphrase")).toBeNull();
    expect(passwordProblem("x".repeat(201))).toBeTruthy();
  });
});

describe("email handling", () => {
  it("lowercases and trims, so one address cannot become two accounts", () => {
    expect(normaliseEmail("  Ravi@Example.COM ")).toBe("ravi@example.com");
  });

  it("accepts plausible addresses and rejects obvious rubbish", () => {
    expect(emailLooksValid("anita@example.in")).toBe(true);
    expect(emailLooksValid("a+tag@sub.example.co.uk")).toBe(true);
    expect(emailLooksValid("not-an-email")).toBe(false);
    expect(emailLooksValid("missing@domain")).toBe(false);
    expect(emailLooksValid("two spaces@example.com")).toBe(false);
    expect(emailLooksValid("")).toBe(false);
  });
});
