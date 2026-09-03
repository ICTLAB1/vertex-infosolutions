import { describe, expect, it } from "vitest";

import {
  REMIND_DAYS_AHEAD,
  daysUntil,
  expiryFor,
  expiryLabel,
  expiryState,
  formatExpiry,
} from "./renewals";

/**
 * Expiry dates are a promise with a date on it.
 *
 * The store says nothing renews automatically and that we warn a month ahead.
 * Both halves rest on this arithmetic: get the date wrong and somebody's
 * software stops on a day nobody told them about.
 */
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("expiryFor", () => {
  it("gives a perpetual licence no expiry at all", () => {
    expect(expiryFor("PERPETUAL", utc("2026-09-02"))).toBeNull();
  });

  it("runs an annual subscription for a year", () => {
    expect(expiryFor("ANNUAL_SUBSCRIPTION", utc("2026-09-02"))).toEqual(
      utc("2027-09-02"),
    );
  });

  /**
   * Billed monthly, committed for a year. The cadence and the term are
   * different things, and treating a monthly commitment as a one-month licence
   * would expire it eleven months early.
   */
  it("runs a monthly commitment for a year, not a month", () => {
    expect(expiryFor("MONTHLY_COMMITMENT", utc("2026-09-02"))).toEqual(
      utc("2027-09-02"),
    );
  });

  /**
   * The date that breaks naive month arithmetic: 29 February has no anniversary
   * in a common year. Adding twelve months by incrementing the month field
   * alone gives 1 March — a licence that outlives its term by a day, and a
   * reminder sent on the wrong date.
   */
  it("pulls 29 February back to the 28th rather than overflowing into March", () => {
    expect(expiryFor("ANNUAL_SUBSCRIPTION", utc("2024-02-29"))).toEqual(
      utc("2025-02-28"),
    );
  });

  it("keeps the time of day, so a licence lasts a full year to the minute", () => {
    const bought = new Date("2026-09-02T14:35:07.000Z");
    expect(expiryFor("ANNUAL_SUBSCRIPTION", bought)?.toISOString()).toBe(
      "2027-09-02T14:35:07.000Z",
    );
  });

  it("does not mutate the date it was given", () => {
    const bought = utc("2026-09-02");
    expiryFor("ANNUAL_SUBSCRIPTION", bought);
    expect(bought).toEqual(utc("2026-09-02"));
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-09-02T23:30:00.000Z");

  it("counts whole days, not elapsed hours", () => {
    // Half an hour away, but a different date: the customer would say tomorrow.
    expect(daysUntil(new Date("2026-09-03T00:00:00.000Z"), now)).toBe(1);
    expect(daysUntil(new Date("2026-09-02T00:01:00.000Z"), now)).toBe(0);
  });

  it("goes negative once the date has passed", () => {
    expect(daysUntil(utc("2026-09-01"), now)).toBe(-1);
  });

  it("crosses a month and a year boundary", () => {
    expect(daysUntil(utc("2026-10-02"), now)).toBe(30);
    expect(daysUntil(utc("2027-09-02"), now)).toBe(365);
  });
});

describe("expiryState", () => {
  const now = utc("2026-09-02");

  it("calls a licence with no expiry perpetual", () => {
    expect(expiryState(null, now)).toBe("perpetual");
  });

  it("turns to expiring exactly on the edge of the reminder window", () => {
    const edge = new Date(now.getTime());
    edge.setUTCDate(edge.getUTCDate() + REMIND_DAYS_AHEAD);
    expect(expiryState(edge, now)).toBe("expiring");

    const outside = new Date(edge.getTime());
    outside.setUTCDate(outside.getUTCDate() + 1);
    expect(expiryState(outside, now)).toBe("active");
  });

  it("is still expiring on the day itself, and expired the day after", () => {
    expect(expiryState(now, now)).toBe("expiring");
    expect(expiryState(utc("2026-09-01"), now)).toBe("expired");
  });
});

describe("expiryLabel", () => {
  const now = utc("2026-09-02");

  // "Sept", not "Sep": en-GB abbreviates September with four letters, and the
  // expectation follows the formatter rather than the formatter being bent to
  // match a guess.
  it("says today and tomorrow in words", () => {
    expect(expiryLabel(now, now)).toBe("Expires today, 2 Sept 2026");
    expect(expiryLabel(utc("2026-09-03"), now)).toBe(
      "Expires tomorrow, 3 Sept 2026",
    );
  });

  it("says what a perpetual licence is instead of leaving it blank", () => {
    expect(expiryLabel(null, now)).toBe("Perpetual — no renewal");
  });

  it("uses the past tense once it has gone", () => {
    expect(expiryLabel(utc("2026-08-30"), now)).toBe("Expired 30 Aug 2026");
  });

  it("counts the days down when the date alone is not enough", () => {
    expect(expiryLabel(utc("2026-10-02"), now)).toBe(
      "Expires 2 Oct 2026 — 30 days",
    );
  });
});

describe("formatExpiry", () => {
  /**
   * Fixed to UTC on purpose. A licence expires on a date, and rendering that
   * date in the server's timezone would show a Delhi customer one day and a
   * Chicago customer another for the same licence.
   */
  it("formats in UTC regardless of where it runs", () => {
    expect(formatExpiry(new Date("2027-01-01T00:30:00.000Z"))).toBe(
      "1 Jan 2027",
    );
    expect(formatExpiry(new Date("2026-12-31T23:30:00.000Z"))).toBe(
      "31 Dec 2026",
    );
  });
});
