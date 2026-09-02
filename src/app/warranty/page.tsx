import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";

export const metadata: Metadata = {
  title: "Warranty",
  description:
    "How manufacturer warranties work on an imported order, what an international warranty means, and how to claim.",
};

export default function WarrantyPage() {
  return (
    <PolicyPage title="Warranty" updated="2 September 2026">
      <p>
        Hardware carries the manufacturer&apos;s warranty, not ours. The length
        is on every product page. What matters on a cross-border order is
        something the product page also tells you: whether that warranty is
        honoured where you live.
      </p>

      <H2>International versus local warranty</H2>
      <p>
        Manufacturers handle this in two ways, and the difference is worth
        understanding before you buy.
      </p>
      <Ul>
        <li>
          <strong className="text-ink">International warranty.</strong> Valid in
          any country with a service network. You take the unit to a local
          authorised centre with the invoice. Most business-grade equipment from
          the major brands works this way.
        </li>
        <li>
          <strong className="text-ink">Country-of-sale warranty.</strong> Valid
          only where the unit was first sold. A claim means sending the unit
          back, at your cost. Where this applies, the product page says so — we
          will not let you find out at the point you need it.
        </li>
      </Ul>
      <p>
        If a product page does not say which applies, ask us before you order and
        we will confirm in writing.
      </p>

      <H2>What the warranty covers</H2>
      <p>
        Manufacturing defects and component failure under normal use, for the
        stated period. It does not cover accidental damage, liquid damage,
        misuse, unauthorised repair, consumables such as toner and batteries
        beyond their rated cycles, or software problems that are not a hardware
        fault.
      </p>

      <H2>The first 30 days are ours</H2>
      <p>
        For the first 30 days after delivery, come to us rather than the
        manufacturer. A fault in that window is handled as a replacement, and we
        cover freight in both directions. This is more than the manufacturer
        offers and it exists because a new unit failing immediately is our
        problem to solve, not yours to negotiate.
      </p>

      <H2>After 30 days</H2>
      <p>
        Claims go to the manufacturer&apos;s service network, and we will help
        you make one: we supply the invoice, the serial number and the proof of
        purchase date, and we will chase on your behalf if the claim stalls. We
        cannot repair equipment ourselves and we will not pretend otherwise.
      </p>

      <H2>What you need to keep</H2>
      <Ul>
        <li>The commercial invoice we emailed you — it is the proof of purchase.</li>
        <li>The serial number, which is on the invoice and on the unit.</li>
        <li>
          The original packaging, if you can. Some manufacturers require it for a
          return and it protects the unit in transit either way.
        </li>
      </Ul>

      <H2>Software licences</H2>
      <p>
        Licences carry no hardware warranty. If a key does not activate we
        replace it at no cost — see{" "}
        <Link href="/returns" className="text-link underline">
          returns &amp; refunds
        </Link>
        . Support for the software itself comes from the publisher under their
        own terms.
      </p>

      <H2>Your statutory rights</H2>
      <p>
        A manufacturer warranty is in addition to, not instead of, the rights
        your own consumer law gives you against the seller. In much of Europe
        that is a two-year legal guarantee of conformity; elsewhere it varies.
        Where your local law gives you more than this page does, your local law
        applies.
      </p>
    </PolicyPage>
  );
}
