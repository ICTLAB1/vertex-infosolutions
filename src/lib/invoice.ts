import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { countryName } from "@/lib/market";
import {
  A4,
  renderPdf,
  toAscii,
  wrapText,
  type PdfOp,
  type PdfPage,
} from "@/lib/pdf";
import { getSiteConfig, type SiteConfig } from "@/lib/site";

/**
 * The invoice.
 *
 * Two documents, decided by where the buyer is, because the sale is two
 * different things in tax law:
 *
 * **India — a tax invoice.** GST is included in the displayed price, so the
 * document has to show its working: taxable value, the GST broken out of the
 * total, the rate, the SAC, the seller's GSTIN and, when the buyer gave one,
 * theirs — that last is what lets a registered business reclaim the tax, and
 * an invoice missing it is worth 18% less to them than it should be.
 *
 * **Anywhere else — a commercial invoice.** The supply is an export of
 * services, zero-rated, so no Indian GST appears at all. Whatever the
 * destination charges is the buyer's to handle, and saying so on the document
 * is more use than silence.
 *
 * Everything is read from the order rather than recomputed. An invoice is a
 * record of what was agreed on the day: a later price change, tax rate change
 * or renamed product must not rewrite it.
 */

export type InvoiceLine = {
  description: string;
  variant: string;
  /**
   * The publisher's own number, as it stood on the day of sale. A buyer
   * matching this invoice against their purchase order matches on this, not on
   * our SKU, so it is printed on the line rather than left to be looked up.
   */
  partNumber: string | null;
  sacCode: string | null;
  qty: number;
  seats: number;
  unitMinor: number;
  amountMinor: number;
};

/** Just enough of an order to bill for it. */
export type InvoiceOrder = {
  number: string;
  createdAt: Date;
  paidAt: Date | null;
  paymentStatus: string;
  paymentMethod: string;
  currency: string;
  country: string;
  email: string;
  billName: string;
  billCompany: string | null;
  billCity: string | null;
  billRegion: string | null;
  billPostcode: string | null;
  gstin: string | null;
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxRatePercent: number;
  taxLabel: string | null;
  items: {
    name: string;
    variantName: string;
    partNumber: string | null;
    sacCode: string | null;
    qty: number;
    seats: number;
    unitPriceMinor: number;
  }[];
};

export type Invoice = {
  /** A domestic supply gets a tax invoice; an export gets a commercial one. */
  kind: "tax" | "commercial";
  title: string;
  number: string;
  issuedOn: Date;
  currency: CurrencyCode;
  paid: boolean;
  paidOn: Date | null;
  paymentMethod: string;
  seller: SiteConfig;
  buyer: {
    name: string;
    company: string | null;
    place: string | null;
    country: string;
    email: string;
    gstin: string | null;
  };
  lines: InvoiceLine[];
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxRatePercent: number;
  taxLabel: string;
  /** The paragraphs under the totals, which differ by regime. */
  notes: string[];
  /**
   * Reasons this document is not yet a valid one, printed on its face.
   *
   * A tax invoice without the seller's GSTIN is not a tax invoice, and the
   * customer's accountant is the wrong person to discover that. Rather than
   * render something that looks official and is not, the document says what is
   * missing — which is also the fastest way for it to get fixed.
   */
  warnings: string[];
};

const PAYMENT_LABELS: Record<string, string> = {
  CARD: "Card",
  UPI: "UPI",
  NETBANKING: "Net banking",
  WALLET: "Wallet",
  BANK_TRANSFER: "Bank transfer",
};

/**
 * Amounts without a currency symbol — the currency is named once in the column
 * heading. The rupee sign is not in the encoding the built-in fonts use, and
 * an invoice is the last place to discover a missing glyph, so it is never
 * asked for.
 */
export function amount(minor: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function place(order: InvoiceOrder): string | null {
  const parts = [order.billCity, order.billRegion, order.billPostcode].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

export function invoiceFor(order: InvoiceOrder, seller: SiteConfig): Invoice {
  const domestic = order.country === "IN";

  return {
    kind: domestic ? "tax" : "commercial",
    title: domestic ? "Tax invoice" : "Commercial invoice",
    number: order.number,
    // The invoice is dated when the order was placed, not when the PDF was
    // asked for. Downloading it again next year must not produce a document
    // dated next year.
    issuedOn: order.createdAt,
    currency: order.currency as CurrencyCode,
    paid: order.paymentStatus === "PAID",
    paidOn: order.paidAt,
    paymentMethod: PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod,
    seller,
    buyer: {
      name: order.billName,
      company: order.billCompany,
      place: place(order),
      country: countryName(order.country),
      email: order.email,
      gstin: domestic ? order.gstin : null,
    },
    lines: order.items.map((item) => ({
      description: item.name,
      variant: item.variantName,
      partNumber: item.partNumber,
      sacCode: domestic ? item.sacCode : null,
      qty: item.qty,
      seats: item.seats,
      unitMinor: item.unitPriceMinor,
      amountMinor: item.unitPriceMinor * item.qty,
    })),
    netMinor: order.netMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    taxRatePercent: order.taxRatePercent,
    taxLabel: order.taxLabel ?? (domestic ? "GST" : "Tax"),
    warnings: invoiceWarnings(domestic, seller),
    notes: domestic
      ? [
          `${order.taxLabel ?? "GST"} at ${order.taxRatePercent}% is included in the price shown, not added to it. The taxable value and the tax are set out above.`,
          "Supply of services. Place of supply is the recipient's location in India.",
          order.gstin
            ? "The recipient's GSTIN is recorded above; input tax credit may be claimed against it subject to the usual conditions."
            : "No GSTIN was given for this order, so no input tax credit can be claimed against it.",
        ]
      : [
          "Export of services. No Indian GST has been charged on this supply.",
          "Any import duty, VAT, GST or sales tax due in the destination country is the responsibility of the recipient. Vertex Infosolutions does not collect it.",
        ],
  };
}

function invoiceWarnings(domestic: boolean, seller: SiteConfig): string[] {
  const missing: string[] = [];
  if (!seller.legalName) missing.push("the seller's registered name");
  if (!seller.address) missing.push("the seller's address");
  if (domestic && !seller.taxIdNumber) {
    missing.push(`the seller's ${seller.taxIdLabel ?? "tax registration"}`);
  }
  if (missing.length === 0) return [];

  return [
    `INCOMPLETE DOCUMENT: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not configured on this store, so this cannot be relied on as a ${domestic ? "tax invoice" : "commercial invoice"}. Ask us for a corrected copy.`,
  ];
}

// ---------------------------------------------------------------------------
// Drawing it
// ---------------------------------------------------------------------------

const MARGIN = 48;
const RIGHT = A4.width - MARGIN;
const INK = 0;
const MUTED = 0.42;

/** Column x positions, right-aligned columns measured at their right edge. */
const COL = {
  description: MARGIN,
  qty: RIGHT - 220,
  unit: RIGHT - 110,
  amount: RIGHT,
};

/**
 * The pages, before they become bytes.
 *
 * Split out so the layout can be inspected: a test can assert that nothing was
 * drawn past the right margin or below the last line of the page, which is the
 * kind of thing that is invisible in a byte comparison and obvious to anybody
 * holding the paper.
 */
export function invoicePages(
  invoice: Invoice,
  now: Date = new Date(),
): PdfPage[] {
  const currency = invoice.currency;
  const pages: PdfPage[] = [];
  let ops: PdfOp[] = [];
  let y = MARGIN;

  /** Nothing is drawn below this; the page footer lives underneath it. */
  const FLOOR = A4.height - 54;


  const text = (
    value: string,
    x: number,
    size: number,
    options: {
      font?: "regular" | "bold";
      grey?: number;
      align?: "left" | "right";
      at?: number;
    } = {},
  ) => {
    if (!value) return; // an unconfigured field is not rendered at all
    const { at, ...rest } = options;
    ops.push({ kind: "text", text: value, x, y: at ?? y, size, ...rest });
  };

  const rule = (grey = 0.8, x1 = MARGIN, x2 = RIGHT) => {
    ops.push({ kind: "line", x1, y1: y, x2, y2: y, grey });
  };

  const breakPage = () => {
    pages.push({ width: A4.width, height: A4.height, ops });
    ops = [];
    y = MARGIN;
  };

  /** Start a new page when what comes next will not fit on this one. */
  const room = (needed: number): boolean => {
    if (y + needed <= FLOOR) return false;
    breakPage();
    return true;
  };

  const columnHeadings = () => {
    ops.push({ kind: "rect", x: MARGIN, y, w: RIGHT - MARGIN, h: 20, grey: 0.93 });
    y += 14;
    text("Description", COL.description + 6, 9, { font: "bold" });
    text("Qty", COL.qty, 9, { font: "bold", align: "right" });
    text(`Unit (${currency})`, COL.unit, 9, { font: "bold", align: "right" });
    text(`Amount (${currency})`, COL.amount - 6, 9, {
      font: "bold",
      align: "right",
    });
    y += 12;
  };

  // --- masthead ------------------------------------------------------------
  text(invoice.seller.tradingName, MARGIN, 20, { font: "bold" });
  text(invoice.title.toUpperCase(), RIGHT, 13, { font: "bold", align: "right" });
  y += 16;
  text(invoice.seller.legalName ?? "", MARGIN, 9, { grey: MUTED });
  text(`No. ${invoice.number}`, RIGHT, 9, { align: "right", grey: MUTED });
  y += 12;
  text(`Issued ${dateFormat.format(invoice.issuedOn)}`, RIGHT, 9, {
    align: "right",
    grey: MUTED,
  });

  // --- the two parties -----------------------------------------------------
  y += 26;
  rule();
  y += 16;

  const partyTop = y;
  text("From", MARGIN, 8, { font: "bold", grey: MUTED });
  y += 12;
  for (const line of [
    invoice.seller.legalName ?? invoice.seller.tradingName,
    ...(invoice.seller.address ? invoice.seller.address.split(/\s*[\n,]\s*/) : []),
    ...(invoice.seller.taxIdNumber
      ? [`${invoice.seller.taxIdLabel ?? "Tax ID"}: ${invoice.seller.taxIdNumber}`]
      : []),
    ...(invoice.seller.registrationNumber
      ? [
          `${invoice.seller.registrationLabel ?? "Registration"}: ${invoice.seller.registrationNumber}`,
        ]
      : []),
    ...(invoice.seller.supportEmail ? [invoice.seller.supportEmail] : []),
  ].filter(Boolean)) {
    text(line, MARGIN, 9);
    y += 12;
  }

  const sellerBottom = y;
  y = partyTop;
  const billX = MARGIN + 270;
  text("Billed to", billX, 8, { font: "bold", grey: MUTED });
  y += 12;
  for (const line of [
    invoice.buyer.company ?? invoice.buyer.name,
    ...(invoice.buyer.company ? [invoice.buyer.name] : []),
    ...(invoice.buyer.place ? [invoice.buyer.place] : []),
    invoice.buyer.country,
    invoice.buyer.email,
    ...(invoice.buyer.gstin ? [`GSTIN: ${invoice.buyer.gstin}`] : []),
  ]) {
    text(line, billX, 9);
    y += 12;
  }

  y = Math.max(sellerBottom, y) + 14;

  // --- the lines -----------------------------------------------------------
  columnHeadings();

  for (const line of invoice.lines) {
    const nameLines = wrapText(
      line.description,
      COL.qty - COL.description - 30,
      10,
      "bold",
    );
    const detail = [
      line.variant,
      line.partNumber,
      // Only when the variant itself covers several seats. Multiplying by the
      // quantity would print "2 seats" beside a Qty column already reading 2.
      line.seats > 1 ? `${line.seats} seats each` : null,
      line.sacCode ? `SAC ${line.sacCode}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
    const detailLines = wrapText(detail, COL.qty - COL.description - 30, 9);

    // A line item is never split across a page break.
    if (room(nameLines.length * 12 + detailLines.length * 11 + 18)) {
      columnHeadings();
    }

    const first = y;
    for (const part of nameLines) {
      text(part, COL.description + 6, 10, { font: "bold" });
      y += 12;
    }
    for (const part of detailLines) {
      text(part, COL.description + 6, 9, { grey: MUTED });
      y += 11;
    }

    // The figures sit on the first line of the description, whatever it wrapped to.
    text(String(line.qty), COL.qty, 10, { align: "right", at: first });
    text(amount(line.unitMinor, currency), COL.unit, 10, {
      align: "right",
      at: first,
    });
    text(amount(line.amountMinor, currency), COL.amount - 6, 10, {
      align: "right",
      at: first,
    });

    y += 6;
    rule(0.88);
    y += 12;
  }

  // --- what is owed --------------------------------------------------------
  const labelX = COL.unit;
  const valueX = COL.amount - 6;

  const totalRow = (label: string, value: string, bold = false) => {
    text(label, labelX, bold ? 11 : 10, {
      align: "right",
      font: bold ? "bold" : "regular",
      grey: bold ? INK : MUTED,
    });
    text(value, valueX, bold ? 11 : 10, {
      align: "right",
      font: bold ? "bold" : "regular",
    });
    y += bold ? 18 : 14;
  };

  // The totals block and the status line under it stay together.
  room(90);
  y += 4;
  if (invoice.taxMinor > 0) {
    totalRow("Taxable value", amount(invoice.netMinor, currency));
    totalRow(
      `${invoice.taxLabel} at ${invoice.taxRatePercent}%`,
      amount(invoice.taxMinor, currency),
    );
  } else {
    totalRow("Subtotal", amount(invoice.netMinor, currency));
    totalRow(
      invoice.kind === "commercial"
        ? "Indian GST (zero-rated export)"
        : `${invoice.taxLabel} at ${invoice.taxRatePercent}%`,
      "0.00",
    );
  }
  // Ten points clear of the next baseline: a rule any lower is drawn through
  // the total rather than above it, which the first render did.
  y -= 10;
  rule(0.4, labelX - 120, RIGHT);
  y += 10;
  totalRow(`Total (${currency})`, amount(invoice.totalMinor, currency), true);

  text(
    invoice.paid
      ? `Paid in full by ${invoice.paymentMethod}${invoice.paidOn ? ` on ${dateFormat.format(invoice.paidOn)}` : ""}.`
      : `Awaiting payment by ${invoice.paymentMethod}. Licence keys are issued when the funds clear.`,
    valueX,
    9,
    { align: "right", grey: MUTED },
  );
  y += 26;

  // --- the small print -----------------------------------------------------
  room(40);
  rule();
  y += 16;

  for (const warning of invoice.warnings) {
    for (const part of wrapText(warning, RIGHT - MARGIN, 9, "bold")) {
      room(14);
      text(part, MARGIN, 9, { font: "bold" });
      y += 12;
    }
    y += 6;
  }

  for (const note of [
    ...invoice.notes,
    "Licences are supplied under the publisher's own end-user terms. Vertex Infosolutions is an authorised reseller and not the licensor.",
    "This is a computer-generated invoice and is valid without a signature.",
  ]) {
    for (const part of wrapText(note, RIGHT - MARGIN, 8.5)) {
      room(13);
      text(part, MARGIN, 8.5, { grey: MUTED });
      y += 11;
    }
    y += 4;
  }

  breakPage();

  // Footers last, because "Page 1 of 3" cannot be written until there are three.
  pages.forEach((page, index) => {
    page.ops.push({
      kind: "text",
      text: `${invoice.seller.tradingName} / ${invoice.number} / generated ${dateFormat.format(now)}`,
      x: MARGIN,
      y: A4.height - 30,
      size: 8,
      grey: 0.55,
    });
    page.ops.push({
      kind: "text",
      text: `Page ${index + 1} of ${pages.length}`,
      x: RIGHT,
      y: A4.height - 30,
      size: 8,
      grey: 0.55,
      align: "right",
    });
  });

  return pages;
}

export function renderInvoice(
  invoice: Invoice,
  now: Date = new Date(),
): Uint8Array {
  return renderPdf(
    invoicePages(invoice, now),
    {
      title: `${invoice.title} ${invoice.number}`,
      author: invoice.seller.legalName ?? invoice.seller.tradingName,
      subject: `${invoice.title} for order ${invoice.number}`,
    },
    now,
  );
}

/** What the browser should call the downloaded file. */
export function invoiceFilename(invoice: Invoice): string {
  return toAscii(
    `${invoice.kind === "tax" ? "tax-invoice" : "invoice"}-${invoice.number}.pdf`,
  ).replace(/[^A-Za-z0-9._-]/g, "-");
}

/** The page frame, exported so the layout tests can check nothing escapes it. */
export const INVOICE_FRAME = { MARGIN, RIGHT, FLOOR: A4.height - 24 };

// ---------------------------------------------------------------------------
// Loading one
// ---------------------------------------------------------------------------

/**
 * Build the invoice for an order id.
 *
 * The single place an order is read for billing, so the confirmation email's
 * attachment and the customer's download are the same document rather than two
 * that drifted. Ownership is **not** checked here — the caller does that, and
 * the download route does it before calling this.
 */
export async function invoiceById(orderId: string): Promise<Invoice | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        select: {
          name: true,
          variantName: true,
          partNumber: true,
          sacCode: true,
          qty: true,
          seats: true,
          unitPriceMinor: true,
        },
      },
    },
  });
  if (!order) return null;
  return invoiceFor(order, await getSiteConfig());
}

/**
 * The invoice as a file to hang on an email.
 *
 * Rendered on demand rather than stored, which is what lets a retry days later
 * send the same document without the outbox carrying a copy of every PDF it
 * ever sent.
 */
export async function invoiceAttachment(
  orderId: string,
): Promise<{ filename: string; content: string } | null> {
  const invoice = await invoiceById(orderId);
  if (!invoice) return null;
  return {
    filename: invoiceFilename(invoice),
    // Base64: what every mail API takes for an inline attachment.
    content: Buffer.from(renderInvoice(invoice)).toString("base64"),
  };
}
