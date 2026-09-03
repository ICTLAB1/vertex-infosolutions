import Link from "next/link";

/**
 * The invitation to ask for volume pricing.
 *
 * Not decoration: the discount is real and this shop cannot yet apply it
 * automatically. Adobe prices in bands from ten seats, and Microsoft volume is
 * negotiated — so a customer buying twenty seats through the basket pays the
 * single-seat price unless they ask. Until the cart can charge a band, the
 * offer has to be visible wherever somebody might be about to buy several,
 * which is why this appears on the product page, in the basket, at checkout
 * and on the home page rather than once in a policy.
 */

const HREF = "/contact?about=bulk";
const THRESHOLD = 10;

/** Full-width panel, for the home page and the basket. */
export function BulkQuoteBanner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-edge/40 bg-amber/10 p-4 ${className}`}
    >
      <div>
        <p className="text-[15px] font-bold text-ink">
          Buying {THRESHOLD} or more licences?
        </p>
        <p className="mt-0.5 max-w-2xl text-[13px] text-muted">
          Volume pricing is lower than the price on the shelf. Tell us the
          product and the seat count and we will quote it — usually the same
          working day.
        </p>
      </div>
      <Link
        href={HREF}
        className="btn-amber shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold transition-transform hover:-translate-y-0.5"
      >
        Get a discounted quote
      </Link>
    </div>
  );
}

/** One line, for a product page or a checkout summary. */
export function BulkQuoteLine({ className = "" }: { className?: string }) {
  return (
    <p
      className={`rounded-md border border-line bg-ground/50 p-2.5 text-[12px] text-muted ${className}`}
    >
      <span className="font-semibold text-ink">
        Need {THRESHOLD} or more?
      </span>{" "}
      <Link href={HREF} className="text-link underline">
        Get a discounted quote
      </Link>{" "}
      — volume pricing is lower than the shelf price, and the licensing is
      cleaner on one order.
    </p>
  );
}
