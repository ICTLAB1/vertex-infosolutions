import { describe, expect, it } from "vitest";

import { A4, renderPdf, textWidth, toAscii, wrapText } from "./pdf";

/**
 * The PDF writer.
 *
 * A malformed PDF does not fail loudly — it opens in one reader and is refused
 * by the next, months later, in front of the customer's accountant. The
 * structural rules that decide that are all checked here.
 */
const page = (ops = []) => ({ width: A4.width, height: A4.height, ops });
const decode = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("file structure", () => {
  const bytes = renderPdf(
    [
      {
        width: A4.width,
        height: A4.height,
        ops: [
          { kind: "text", x: 40, y: 40, size: 12, text: "Tax invoice" },
          { kind: "line", x1: 40, y1: 60, x2: 300, y2: 60 },
          { kind: "rect", x: 40, y: 70, w: 100, h: 20, grey: 0.9 },
        ],
      },
    ],
    { title: "Test", author: "Vertex" },
    new Date("2026-09-02T18:00:00Z"),
  );
  const file = decode(bytes);

  it("starts with a version header and a binary marker", () => {
    expect(file.startsWith("%PDF-1.7\n")).toBe(true);
    // The second line's high bytes are what tell anything moving the file that
    // it is binary and must not have its line endings helpfully rewritten.
    expect(file.slice(9, 15)).toBe("%\xE2\xE3\xCF\xD3\n");
  });

  it("ends with the end-of-file marker", () => {
    expect(file.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  /**
   * The cross-reference table is a list of byte offsets into the file itself.
   * A reader jumps straight to them; one that is wrong by a byte gives a file
   * some readers open and others reject.
   */
  it("gives every object an offset that lands on that object", () => {
    const startxref = Number(file.match(/startxref\n(\d+)/)![1]);
    expect(file.slice(startxref, startxref + 4)).toBe("xref");

    // xref / "0 N" / the free-list head / then one entry per object.
    const table = file.slice(startxref).split("\n");
    const count = Number(table[1].split(" ")[1]);
    for (let object = 1; object < count; object += 1) {
      const offset = Number(table[2 + object].slice(0, 10));
      expect(file.slice(offset, offset + `${object} 0 obj`.length)).toBe(
        `${object} 0 obj`,
      );
    }
  });

  it("declares a stream length that matches the stream", () => {
    const match = file.match(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/)!;
    expect(Buffer.byteLength(match[2], "latin1")).toBe(Number(match[1]));
  });

  it("uses only the fonts every reader already has", () => {
    expect(file).toContain("/BaseFont /Helvetica /Encoding /WinAnsiEncoding");
    expect(file).toContain("/BaseFont /Helvetica-Bold");
  });

  it("counts its pages", () => {
    const many = decode(
      renderPdf([page(), page(), page()], { title: "T", author: "A" }),
    );
    expect(many).toContain("/Count 3");
  });

  it("refuses to write a document with no pages", () => {
    expect(() => renderPdf([], { title: "T", author: "A" })).toThrow();
  });
});

/**
 * A stray parenthesis ends a PDF string early, and everything after it is read
 * as instructions. A product called "Creative Cloud (All Apps)" would do it.
 */
describe("escaping", () => {
  it("escapes the characters that would end a string early", () => {
    const file = decode(
      renderPdf(
        [
          {
            width: A4.width,
            height: A4.height,
            ops: [
              {
                kind: "text",
                x: 10,
                y: 10,
                size: 10,
                text: "Creative Cloud (All Apps) \\ 2026",
              },
            ],
          },
        ],
        { title: "T", author: "A" },
      ),
    );
    expect(file).toContain("(Creative Cloud \\(All Apps\\) \\\\ 2026)");
  });

  it("escapes them in the document title too", () => {
    const file = decode(
      renderPdf([page()], { title: "Invoice (final)", author: "A" }),
    );
    expect(file).toContain("/Title (Invoice \\(final\\))");
  });
});

describe("toAscii", () => {
  /**
   * The rupee sign is not in WinAnsi, so Helvetica cannot draw it. Asking
   * anyway produces a blank or a wrong glyph — on a document about money.
   */
  it("turns the rupee sign into something the font can draw", () => {
    expect(toAscii("₹9,200")).toBe("INR 9,200");
  });

  it("flattens the typography the rest of the store is written in", () => {
    expect(toAscii("1 user — 1 year · publisher's terms “as sold”")).toBe(
      "1 user - 1 year - publisher's terms \"as sold\"",
    );
  });

  it("drops what it cannot represent rather than emitting nonsense", () => {
    expect(toAscii("Ω≈ç")).toBe("");
  });
});

describe("measuring text", () => {
  it("uses the real metrics, so a column of figures lines up", () => {
    // Helvetica digits are all 556/1000 em; five of them at 10pt is 27.8pt.
    expect(textWidth("12345", 10, "regular")).toBeCloseTo(27.8, 5);
    // A space is narrower than a digit, and bold is wider than regular.
    expect(textWidth(" ", 10, "regular")).toBeCloseTo(2.78, 5);
    expect(textWidth("Total", 10, "bold")).toBeGreaterThan(
      textWidth("Total", 10, "regular"),
    );
  });

  it("scales with the size", () => {
    expect(textWidth("Vertex", 20, "regular")).toBeCloseTo(
      textWidth("Vertex", 10, "regular") * 2,
      5,
    );
  });
});

describe("wrapText", () => {
  const long =
    "Autodesk Architecture, Engineering & Construction Collection";

  it("keeps every line inside the width it was given", () => {
    const lines = wrapText(long, 200, 10, "bold");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(textWidth(line, 10, "bold")).toBeLessThanOrEqual(200);
    }
  });

  it("loses no words", () => {
    expect(wrapText(long, 200, 10, "bold").join(" ")).toBe(long);
  });

  /** A single word wider than the column still has to be drawn. */
  it("does not drop a word it cannot fit", () => {
    expect(wrapText("Supercalifragilistic", 10, 10)).toEqual([
      "Supercalifragilistic",
    ]);
  });

  it("returns one empty line for empty text, not nothing", () => {
    expect(wrapText("   ", 100, 10)).toEqual([""]);
  });
});
