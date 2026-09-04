import { describe, expect, it } from "vitest";

import { analyticsAllowed, readConsent } from "@/lib/consent";

/**
 * The one rule this has to get right: anything that is not an explicit yes is
 * a no. A consent check that fails open is worse than having no banner at all,
 * because the page then claims to have asked.
 */
describe("reading the consent cookie", () => {
  it("understands the two answers", () => {
    expect(readConsent("granted")).toBe("granted");
    expect(readConsent("denied")).toBe("denied");
  });

  it("treats a missing cookie as undecided", () => {
    expect(readConsent(undefined)).toBeNull();
    expect(readConsent(null)).toBeNull();
    expect(readConsent("")).toBeNull();
  });

  it("treats anything unrecognised as undecided", () => {
    // A truncated, tampered or stale value must never read as consent.
    for (const value of [
      "true",
      "yes",
      "GRANTED",
      "granted ",
      "grante",
      "granted;denied",
      "1",
      "accepted",
    ]) {
      expect(readConsent(value), value).toBeNull();
    }
  });
});

describe("what counts as permission", () => {
  it("is only a definite yes", () => {
    expect(analyticsAllowed("granted")).toBe(true);
  });

  it("is not a no, and not silence", () => {
    // Silence is the case that matters: somebody who scrolls past the banner
    // has not agreed, and must not be measured.
    expect(analyticsAllowed("denied")).toBe(false);
    expect(analyticsAllowed(null)).toBe(false);
  });
});
