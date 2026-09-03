import { afterEach, describe, expect, it } from "vitest";

import { clientIp } from "./rate-limit";

/**
 * Working out who is calling.
 *
 * Every one of these headers is just a header — a caller that can reach the
 * container directly can write whatever it likes in them. That is why the
 * limiter also counts on the email address, which no header can change. What
 * these tests protect is the ordinary case: that behind a proper edge, the
 * address read is the one the edge saw.
 */
const headers = (values: Record<string, string>) => new Headers(values);

const original = process.env.CLIENT_IP_HEADER;
afterEach(() => {
  if (original === undefined) delete process.env.CLIENT_IP_HEADER;
  else process.env.CLIENT_IP_HEADER = original;
});

describe("clientIp", () => {
  it("prefers the header the operator pinned", () => {
    process.env.CLIENT_IP_HEADER = "x-real-ip";
    expect(
      clientIp(
        headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }),
      ),
    ).toBe("203.0.113.7");
  });

  it("reads the headers an edge sets", () => {
    expect(clientIp(headers({ "cf-connecting-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(headers({ "true-client-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientIp(headers({ "x-azure-clientip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  /**
   * Each hop appends, so the rightmost entry is the one the nearest proxy
   * observed. The leftmost is whatever the original caller claimed — reading
   * that would let an attacker rotate a fake address per request and evade the
   * limit entirely.
   */
  it("takes the forwarded address the nearest proxy saw, not the one claimed", () => {
    expect(
      clientIp(headers({ "x-forwarded-for": "10.0.0.1, 198.51.100.1, 203.0.113.7" })),
    ).toBe("203.0.113.7");
  });

  it("strips the port App Service appends", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7:52190" }))).toBe(
      "203.0.113.7",
    );
  });

  it("handles IPv6, bracketed with a port and bare", () => {
    expect(clientIp(headers({ "x-forwarded-for": "[2001:db8::1]:443" }))).toBe(
      "2001:db8::1",
    );
    expect(clientIp(headers({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(headers({ "cf-connecting-ip": "::1" }))).toBe("::1");
  });

  /**
   * "unknown" is a bucket like any other, so callers the edge cannot identify
   * are still counted — together, which is the safe direction to err in.
   */
  it("says unknown rather than inventing an address", () => {
    expect(clientIp(headers({}))).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": "  ,  , " }))).toBe("unknown");
    expect(clientIp(headers({ "cf-connecting-ip": "   " }))).toBe("unknown");
  });

  it("refuses a value too long to be an address", () => {
    expect(clientIp(headers({ "cf-connecting-ip": "a".repeat(200) }))).toBe("unknown");
  });

  it("does not care about surrounding whitespace", () => {
    expect(clientIp(headers({ "x-forwarded-for": " 203.0.113.7 " }))).toBe("203.0.113.7");
  });
});
