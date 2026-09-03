import { afterEach, describe, expect, it } from "vitest";

import { adminEmails, isAdmin } from "./admin";

/**
 * Who may run the store.
 *
 * The failure that matters here is the open one — a misread configuration that
 * makes everybody an administrator — so that is what most of this checks.
 */
const original = process.env.ADMIN_EMAILS;
afterEach(() => {
  process.env.ADMIN_EMAILS = original;
});

const withList = (value: string | undefined) => {
  if (value === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = value;
};

describe("isAdmin", () => {
  it("admits the addresses on the list", () => {
    withList("priya@vertex.example, dev@vertex.example");
    expect(isAdmin("priya@vertex.example")).toBe(true);
    expect(isAdmin("dev@vertex.example")).toBe(true);
  });

  it("refuses everybody else", () => {
    withList("priya@vertex.example");
    expect(isAdmin("someone@else.example")).toBe(false);
  });

  /**
   * The important one. A configuration that failed to load, or was never set,
   * must lock the door rather than open it to the next visitor.
   */
  it("admits nobody when the list is empty or missing", () => {
    for (const value of ["", "   ", ",", undefined]) {
      withList(value);
      expect(isAdmin("priya@vertex.example")).toBe(false);
      expect(adminEmails()).toEqual([]);
    }
  });

  it("refuses an empty or missing address", () => {
    withList("priya@vertex.example");
    expect(isAdmin("")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  /** A stray capital or space in the configuration must not lock somebody out. */
  it("does not care how the list or the address was typed", () => {
    withList("  Priya@Vertex.Example  ,  DEV@vertex.example ");
    expect(isAdmin("priya@vertex.example")).toBe(true);
    expect(isAdmin("  PRIYA@VERTEX.EXAMPLE ")).toBe(true);
    expect(isAdmin("dev@vertex.example")).toBe(true);
  });

  it("splits on spaces as well as commas", () => {
    withList("a@x.example b@x.example\nc@x.example");
    expect(adminEmails()).toEqual(["a@x.example", "b@x.example", "c@x.example"]);
  });

  /** Something that is not an address cannot match an address. */
  it("ignores entries that are not addresses", () => {
    withList("priya@vertex.example, everyone, *, true");
    expect(adminEmails()).toEqual(["priya@vertex.example"]);
    expect(isAdmin("everyone")).toBe(false);
    expect(isAdmin("*")).toBe(false);
  });

  /**
   * A prefix match would let priya@vertex.example.attacker.test in. The
   * comparison is whole-string.
   */
  it("matches the whole address, not a prefix of it", () => {
    withList("priya@vertex.example");
    expect(isAdmin("priya@vertex.example.attacker.test")).toBe(false);
    expect(isAdmin("notpriya@vertex.example")).toBe(false);
  });
});
