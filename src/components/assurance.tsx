import Image from "next/image";
import Link from "next/link";

import { DELIVERY_WINDOW } from "@/lib/delivery";

/**
 * What we can say for a listing that has no reviews yet.
 *
 * A new shop has no ratings, and five grey stars above "0.0" says "nobody has
 * bought this" louder than saying nothing at all. The answer is not to invent
 * ratings — a rating is a claim about other customers, and there aren't any
 * yet — but to put in that space the things a business buyer actually checks
 * before trusting a supplier they have not used: that the licence is genuine
 * and traceable, that the invoice will satisfy their accountant, and that
 * there is a stated way out if it goes wrong.
 *
 * Every line here is checkable. The Adobe badge is issued by Adobe; the
 * Microsoft SKU is the identifier on Microsoft's own price list, so a buyer can
 * confirm the product is what it says; the invoice and refund lines link to the
 * policies that commit us to them. Nothing here is a claim about a customer.
 */
export function Assurance({
  brand,
  domestic,
  sku,
}: {
  brand: string;
  /** True in the Indian market, where a GST invoice is what accounts want. */
  domestic: boolean;
  /** The publisher's own SKU identifier, where the product carries one. */
  sku: string | null;
}) {
  const adobe = brand === "Adobe";

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-[14px] font-bold text-ink">
        Buying from Vertex Infosolutions
      </h2>

      <ul className="mt-2.5 space-y-2 text-[13px] text-muted">
        <Item>
          A genuine licence, supplied under {brand}&apos;s own end-user terms.
          Vertex is an authorised reseller, not the licensor.
        </Item>

        {sku ? (
          <Item>
            Publisher SKU <span className="font-mono text-ink">{sku}</span> — the
            identifier on {brand}&apos;s own price list, so you can confirm this
            is the product you meant to buy.
          </Item>
        ) : null}

        <Item>
          {domestic ? (
            <>
              A GST tax invoice with your GSTIN on it, so your accounts can claim
              the input credit.
            </>
          ) : (
            <>
              A zero-rated export invoice. No Indian GST is charged on a supply
              outside India.
            </>
          )}{" "}
          <Link href="/terms" className="text-link underline">
            Terms
          </Link>
        </Item>

        <Item>
          Issued to your account {DELIVERY_WINDOW}, with a stated refund
          position if it cannot be delivered.{" "}
          <Link href="/returns" className="text-link underline">
            Refund policy
          </Link>
        </Item>
      </ul>

      {adobe ? (
        <div className="mt-3 border-t border-line-soft pt-3">
          <Image
            src="/badges/adobe-certified-reseller.png"
            alt="Adobe Certified Reseller"
            width={1814}
            height={788}
            sizes="140px"
            className="h-auto w-[140px]"
          />
        </div>
      ) : null}
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <svg
        viewBox="0 0 16 16"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok"
        aria-hidden="true"
      >
        <path
          d="M2.5 8.5l3.5 3.5 7.5-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{children}</span>
    </li>
  );
}
