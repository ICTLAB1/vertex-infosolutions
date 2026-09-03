/**
 * A very small PDF writer.
 *
 * An invoice is the one document a customer keeps, forwards to their finance
 * team and produces for an auditor years later, so it has to be a real file
 * rather than a printable web page. That could have been a library; it is a
 * hundred lines here instead, because every PDF renderer worth adding brings a
 * font pipeline with it, and this document needs exactly two of the fourteen
 * fonts every PDF reader already has built in.
 *
 * What it does: one or more pages of Helvetica text, rules and filled
 * rectangles. What it deliberately does not do: images, embedded fonts,
 * compression, or anything outside WinAnsi. Anything richer than that is a
 * signal to reach for a library instead of extending this.
 *
 * No `server-only` marker: this is arithmetic and string building, with no
 * database, no secrets and no request. Keeping it pure is what lets it be
 * tested directly.
 */

export type PdfFont = "regular" | "bold";

/**
 * Drawing instructions, in **top-left** coordinates measured in points.
 *
 * PDF itself measures from the bottom-left, which makes laying out a document
 * that reads downwards an exercise in subtraction. The flip happens once, on
 * the way out, so the invoice code can say "18 points from the top" and mean
 * it.
 */
export type PdfOp =
  | {
      kind: "text";
      x: number;
      y: number;
      size: number;
      text: string;
      font?: PdfFont;
      /** 0 is black, 1 is white. */
      grey?: number;
      /** `right` puts the *end* of the text at x — for a column of figures. */
      align?: "left" | "right";
    }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width?: number;
      grey?: number;
    }
  | { kind: "rect"; x: number; y: number; w: number; h: number; grey: number };

export type PdfPage = { width: number; height: number; ops: PdfOp[] };

export type PdfMeta = { title: string; author: string; subject?: string };

/** A4 in points, which is what an Indian or European customer will print on. */
export const A4 = { width: 595.28, height: 841.89 };

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/**
 * Character widths in 1/1000 em for the two base fonts, ASCII 32–126.
 *
 * Needed to right-align a column of amounts, which is the difference between a
 * document that looks like an invoice and one that looks like a form letter.
 * These are Adobe's published metrics for Helvetica; because the fonts are the
 * reader's own, the numbers have to match or the alignment drifts.
 */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
];

/**
 * Reduce text to the ASCII the base fonts can be trusted to draw.
 *
 * The store's own copy is full of en dashes and curly quotes, and the rupee
 * sign is not in WinAnsi at all — a PDF asking Helvetica for ₹ produces either
 * nothing or a wrong glyph, on a document about money. Everything is mapped to
 * a plain equivalent rather than dropped silently, and amounts are written as
 * "INR 9,200.00" for the same reason.
 */
export function toAscii(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[·•]/g, "-")
    .replace(/ /g, " ")
    .replace(/₹/g, "INR ")
    .replace(/€/g, "EUR ")
    .replace(/£/g, "GBP ")
    .replace(/[^\x20-\x7E]/g, "");
}

/** How wide a string is at a given size, in points. */
export function textWidth(text: string, size: number, font: PdfFont): number {
  const widths = font === "bold" ? HELVETICA_BOLD : HELVETICA;
  let total = 0;
  for (const character of toAscii(text)) {
    const index = character.charCodeAt(0) - 32;
    total += widths[index] ?? 556;
  }
  return (total * size) / 1000;
}

/**
 * Break text to fit a column, on spaces where possible.
 *
 * A product name is whatever a publisher decided to call it, and
 * "Autodesk Architecture, Engineering & Construction Collection" is a real one
 * — long enough to run into the price column if nothing wraps it.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  size: number,
  font: PdfFont = "regular",
): string[] {
  const words = toAscii(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, font) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** `(`, `)` and `\` end or escape a PDF string literal, so they are escaped. */
function escapeString(text: string): string {
  return toAscii(text).replace(/([\\()])/g, "\\$1");
}

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

function contentStream(page: PdfPage): string {
  const parts: string[] = [];
  const flip = (y: number) => (page.height - y).toFixed(2);

  for (const op of page.ops) {
    if (op.kind === "rect") {
      parts.push(
        `${op.grey.toFixed(3)} g ${op.x.toFixed(2)} ${flip(op.y + op.h)} ${op.w.toFixed(2)} ${op.h.toFixed(2)} re f`,
      );
      continue;
    }
    if (op.kind === "line") {
      parts.push(
        `${(op.grey ?? 0.8).toFixed(3)} G ${(op.width ?? 0.5).toFixed(2)} w ${op.x1.toFixed(2)} ${flip(op.y1)} m ${op.x2.toFixed(2)} ${flip(op.y2)} l S`,
      );
      continue;
    }

    const font = op.font === "bold" ? "/F2" : "/F1";
    const x =
      op.align === "right" ? op.x - textWidth(op.text, op.size, op.font ?? "regular") : op.x;
    parts.push(
      `BT ${(op.grey ?? 0).toFixed(3)} g ${font} ${op.size} Tf 1 0 0 1 ${x.toFixed(2)} ${flip(op.y)} Tm (${escapeString(op.text)}) Tj ET`,
    );
  }

  return parts.join("\n");
}

/** PDF wants D:YYYYMMDDHHmmSS with an explicit zone; everything here is UTC. */
function pdfDate(when: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `D:${when.getUTCFullYear()}${pad(when.getUTCMonth() + 1)}${pad(when.getUTCDate())}` +
    `${pad(when.getUTCHours())}${pad(when.getUTCMinutes())}${pad(when.getUTCSeconds())}Z`
  );
}

/**
 * Assemble the file.
 *
 * The cross-reference table is a list of byte offsets into the file itself, so
 * the objects are written first and measured as they go. An offset that is
 * wrong by one byte gives a file that some readers open and others reject, so
 * they are counted rather than estimated.
 */
export function renderPdf(
  pages: PdfPage[],
  meta: PdfMeta,
  now: Date = new Date(),
): Uint8Array {
  if (pages.length === 0) throw new Error("A PDF needs at least one page.");

  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length; // object numbers are 1-based
  };

  const catalogueNumber = 1;
  const pagesNumber = 2;
  objects.push("", ""); // reserved for the catalogue and the page tree

  const regular = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const bold = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  const pageNumbers: number[] = [];
  for (const page of pages) {
    const stream = contentStream(page);
    const contents = add(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
    pageNumbers.push(
      add(
        `<< /Type /Page /Parent ${pagesNumber} 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] ` +
          `/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${contents} 0 R >>`,
      ),
    );
  }

  objects[catalogueNumber - 1] =
    `<< /Type /Catalog /Pages ${pagesNumber} 0 R >>`;
  objects[pagesNumber - 1] =
    `<< /Type /Pages /Kids [${pageNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNumbers.length} >>`;

  const info = add(
    `<< /Title (${escapeString(meta.title)}) /Author (${escapeString(meta.author)}) ` +
      (meta.subject ? `/Subject (${escapeString(meta.subject)}) ` : "") +
      `/Producer (Vertex Infosolutions) /CreationDate (${pdfDate(now)}) >>`,
  );

  const chunks: Buffer[] = [];
  let offset = 0;
  const write = (text: string) => {
    const buffer = Buffer.from(text, "latin1");
    chunks.push(buffer);
    offset += buffer.length;
  };

  // A binary comment on the second line marks the file as binary, so anything
  // moving it treats it as such rather than helpfully rewriting line endings.
  write("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n");

  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(offset);
    write(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });

  const startxref = offset;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((value) => `${String(value).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root ${catalogueNumber} 0 R /Info ${info} 0 R >>`,
    "startxref",
    String(startxref),
    "%%EOF\n",
  ].join("\n");
  write(xref);

  return new Uint8Array(Buffer.concat(chunks));
}
