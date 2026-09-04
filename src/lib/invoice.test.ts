import { describe, expect, it } from "vitest";

import {
  amount,
  INVOICE_FRAME,
  invoiceFor,
  invoiceFilename,
  invoicePages,
  renderInvoice,
  type InvoiceOrder,
} from "./invoice";
import type { SiteConfig } from "./site";

/**
 * The invoice.
 *
 * Two documents, decided by where the buyer is, because the sale is two
 * different things in tax law — and the difference is worth 18% to an Indian
 * business that can reclaim the GST, and a compliance problem if an export is
 * billed as though it were not one.
 */
const SELLER: SiteConfig = {
  tradingName: "Vertex Infosolutions",
  legalName: "Vertex Infosolutions Private Limited",
  address: "5th Floor, Amar Tech Park, Balewadi, Pune 411045",
  shipsFrom: "India",
  registrationLabel: "CIN",
  registrationNumber: "U72900PN2019PTC123456",
  taxIdLabel: "GSTIN",
  taxIdNumber: "27AAACV1234A1Z5",
  supportEmail: "orders@vertexinfosolutions.example",
  supportPhone: null,
  supportHours: "Monday to Friday",
  complaintsName: null,
  complaintsEmail: null,
};

const ORDER: InvoiceOrder = {
  number: "VX-2026-004182",
  createdAt: new Date("2026-08-30T09:12:00Z"),
  paidAt: new Date("2026-08-30T09:13:41Z"),
  paymentStatus: "PAID",
  paymentMethod: "CARD",
  currency: "INR",
  country: "IN",
  email: "accounts@sharma.example",
  billName: "Priya Sharma",
  billCompany: "Sharma Engineering Services Pvt Ltd",
  billCity: "Pune",
  billRegion: "Maharashtra",
  billPostcode: "411045",
  gstin: "27AABCU9603R1ZM",
  netMinor: 5_00_000_00,
  taxMinor: 90_000_00,
  totalMinor: 5_90_000_00,
  taxRatePercent: 18,
  taxLabel: "GST",
  items: [
    {
      name: "Adobe Photoshop for teams",
      variantName: "1 user, 1 year",
      partNumber: "65297615BA01A12",
      sacCode: "997331",
      qty: 2,
      seats: 1,
      unitPriceMinor: 2_95_000_00,
    },
  ],
};

const EXPORT: InvoiceOrder = {
  ...ORDER,
  number: "VX-2026-004183",
  currency: "USD",
  country: "DE",
  // Deliberately left on the order: a GSTIN typed by a buyer who is not in
  // India must not turn an export into a domestic supply.
  gstin: "27AABCU9603R1ZM",
  netMinor: 4_812_00,
  taxMinor: 0,
  totalMinor: 4_812_00,
  taxRatePercent: 0,
  taxLabel: null,
};

describe("which document this is", () => {
  it("bills an Indian buyer with a tax invoice", () => {
    const invoice = invoiceFor(ORDER, SELLER);
    expect(invoice.kind).toBe("tax");
    expect(invoice.title).toBe("Tax invoice");
    expect(invoice.buyer.gstin).toBe("27AABCU9603R1ZM");
    expect(invoice.lines[0].sacCode).toBe("997331");
    expect(invoice.notes.join(" ")).toContain("included in the price shown");
    expect(invoice.notes.join(" ")).toContain("input tax credit");
  });

  it("bills everyone else with a commercial invoice and no Indian tax", () => {
    const invoice = invoiceFor(EXPORT, SELLER);
    expect(invoice.kind).toBe("commercial");
    expect(invoice.title).toBe("Commercial invoice");
    expect(invoice.taxMinor).toBe(0);
    expect(invoice.notes.join(" ")).toContain("Export of services");
    expect(invoice.notes.join(" ")).toContain("responsibility of the recipient");
  });

  /**
   * A GSTIN on an export is meaningless and printing it would suggest Indian
   * tax was involved. The SAC is an Indian classification and goes with it.
   */
  it("keeps the GSTIN and the SAC off an export", () => {
    const invoice = invoiceFor(EXPORT, SELLER);
    expect(invoice.buyer.gstin).toBeNull();
    expect(invoice.lines[0].sacCode).toBeNull();
  });

  it("says so when an Indian order carried no GSTIN", () => {
    const invoice = invoiceFor({ ...ORDER, gstin: null }, SELLER);
    expect(invoice.notes.join(" ")).toContain("no input tax credit");
  });

  /**
   * The invoice is dated when the order was placed. Downloading it again next
   * year must not produce a document dated next year.
   */
  it("is dated by the order, not by the download", () => {
    expect(invoiceFor(ORDER, SELLER).issuedOn).toEqual(ORDER.createdAt);
  });
});

describe("the figures", () => {
  it("copies the order rather than recomputing it", () => {
    const invoice = invoiceFor(ORDER, SELLER);
    expect(invoice.netMinor).toBe(ORDER.netMinor);
    expect(invoice.taxMinor).toBe(ORDER.taxMinor);
    expect(invoice.totalMinor).toBe(ORDER.totalMinor);
    expect(invoice.netMinor + invoice.taxMinor).toBe(invoice.totalMinor);
  });

  it("multiplies each line out", () => {
    expect(invoiceFor(ORDER, SELLER).lines[0].amountMinor).toBe(5_90_000_00);
  });

  it("groups digits the way each market writes them", () => {
    expect(amount(5_90_000_00, "INR")).toBe("5,90,000.00");
    expect(amount(5_90_000_00, "USD")).toBe("590,000.00");
  });

  it("always shows the minor unit, so lines visibly sum to the total", () => {
    expect(amount(150_00, "USD")).toBe("150.00");
  });
});

/**
 * A tax invoice without the seller's GSTIN is not a tax invoice. Rather than
 * produce something that looks official and is not, the document says so.
 */
describe("an invoice that cannot be valid", () => {
  const bare: SiteConfig = {
    ...SELLER,
    legalName: null,
    address: null,
    taxIdNumber: null,
  };

  it("prints what is missing on its face", () => {
    const invoice = invoiceFor(ORDER, bare);
    expect(invoice.warnings).toHaveLength(1);
    expect(invoice.warnings[0]).toContain("INCOMPLETE DOCUMENT");
    expect(invoice.warnings[0]).toContain("GSTIN");
  });

  it("does not ask an export for a GSTIN it has no use for", () => {
    const invoice = invoiceFor(EXPORT, { ...SELLER, taxIdNumber: null });
    expect(invoice.warnings).toHaveLength(0);
  });

  it("says nothing when the store is properly configured", () => {
    expect(invoiceFor(ORDER, SELLER).warnings).toEqual([]);
  });
});

describe("the page", () => {
  const many = (count: number): InvoiceOrder => ({
    ...ORDER,
    items: Array.from({ length: count }, (_, index) => ({
      ...ORDER.items[0],
      name: `Autodesk Product Number ${index + 1}`,
    })),
  });

  it("fits a short order on one page", () => {
    expect(invoicePages(invoiceFor(ORDER, SELLER))).toHaveLength(1);
  });

  /** Twenty licences is an ordinary order for a company, not an edge case. */
  it("runs a long order onto more pages rather than off the bottom", () => {
    const pages = invoicePages(invoiceFor(many(30), SELLER));
    expect(pages.length).toBeGreaterThan(1);
  });

  it("repeats the column headings on every page", () => {
    const pages = invoicePages(invoiceFor(many(30), SELLER));
    for (const page of pages) {
      const headings = page.ops.filter(
        (op) => op.kind === "text" && op.text === "Description",
      );
      // The last page may hold only totals and notes.
      expect(headings.length).toBeLessThanOrEqual(1);
    }
    expect(
      pages[0].ops.some((op) => op.kind === "text" && op.text === "Description"),
    ).toBe(true);
  });

  it("numbers the pages", () => {
    const pages = invoicePages(invoiceFor(many(30), SELLER));
    expect(
      pages[0].ops.some(
        (op) => op.kind === "text" && op.text === `Page 1 of ${pages.length}`,
      ),
    ).toBe(true);
  });

  /**
   * The failure this catches is a document that looks fine in a byte
   * comparison and has a total printed off the edge of the paper.
   */
  it("keeps everything inside the printable frame", () => {
    for (const page of invoicePages(invoiceFor(many(30), SELLER))) {
      for (const op of page.ops) {
        if (op.kind === "text") {
          expect(op.x).toBeGreaterThanOrEqual(INVOICE_FRAME.MARGIN - 1);
          expect(op.x).toBeLessThanOrEqual(INVOICE_FRAME.RIGHT + 1);
          expect(op.y).toBeLessThanOrEqual(INVOICE_FRAME.FLOOR);
          expect(op.y).toBeGreaterThan(0);
        }
        if (op.kind === "line") {
          expect(op.x2).toBeLessThanOrEqual(INVOICE_FRAME.RIGHT + 1);
          expect(op.y1).toBeLessThanOrEqual(INVOICE_FRAME.FLOOR);
        }
      }
    }
  });
});

describe("the file", () => {
  it("is a PDF", () => {
    const bytes = renderInvoice(invoiceFor(ORDER, SELLER));
    expect(Buffer.from(bytes.slice(0, 8)).toString()).toBe("%PDF-1.7");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("is named so a folder of them sorts by order number", () => {
    expect(invoiceFilename(invoiceFor(ORDER, SELLER))).toBe(
      "tax-invoice-VX-2026-004182.pdf",
    );
    expect(invoiceFilename(invoiceFor(EXPORT, SELLER))).toBe(
      "invoice-VX-2026-004183.pdf",
    );
  });
});

describe("the part number on an invoice", () => {
  it("is printed on the line", () => {
    // A finance team matches this invoice against a purchase order raised on
    // the publisher's number. Leaving it to be looked up is leaving it out.
    expect(invoiceFor(ORDER, SELLER).lines[0].partNumber).toBe(
      "65297615BA01A12",
    );
  });

  it("is copied from the order line, not looked up in the catalogue", () => {
    // The catalogue can be re-priced, renumbered or withdrawn; the invoice is
    // a record of what was sold on the day, so the number travels with it.
    const renumbered = {
      ...ORDER,
      items: [{ ...ORDER.items[0], partNumber: "SOMETHING-ELSE" }],
    };
    expect(invoiceFor(renumbered, SELLER).lines[0].partNumber).toBe(
      "SOMETHING-ELSE",
    );
  });

  it("survives an order line that never had one", () => {
    const noNumber = {
      ...ORDER,
      items: [{ ...ORDER.items[0], partNumber: null }],
    };
    expect(invoiceFor(noNumber, SELLER).lines[0].partNumber).toBeNull();
  });
});

describe("the part number on the printed page", () => {
  /** Every string the layout actually draws. */
  const drawn = (invoice: ReturnType<typeof invoiceFor>) =>
    invoicePages(invoice)
      .flatMap((page) => page.ops)
      .filter((op) => op.kind === "text")
      .map((op) => (op as { text: string }).text);

  it("reaches the paper, not just the data", () => {
    expect(drawn(invoiceFor(ORDER, SELLER)).join(" ")).toContain(
      "65297615BA01A12",
    );
  });

  it("does not push a long detail line past the right margin", () => {
    // The detail row now carries the variant, the part number, the seat count
    // and the SAC code. A wrap that fails puts text over the price column.
    const wordy = {
      ...ORDER,
      items: [
        {
          ...ORDER.items[0],
          variantName: "1 user, 1 year, annual commitment billed yearly",
          partNumber: "CFQ7TTC0LH2Z:1",
          seats: 25,
        },
      ],
    };
    for (const page of invoicePages(invoiceFor(wordy, SELLER))) {
      for (const op of page.ops) {
        if (op.kind !== "text") continue;
        expect(op.x, op.text).toBeLessThan(595 - 30);
      }
    }
  });
});
