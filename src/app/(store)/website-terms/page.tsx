import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";
import { getSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Website terms of use",
  description:
    "The terms on which you may use this website, as distinct from the terms on which we sell.",
};

export default function WebsiteTermsPage() {
  const config = getSiteConfig();

  return (
    <PolicyPage title="Website terms of use" updated="2 September 2026">
      <p>
        These cover using the website. The separate{" "}
        <Link href="/terms" className="text-link underline">
          terms of sale
        </Link>{" "}
        cover buying something — that is the document that matters if you place
        an order.
      </p>
      <p>
        The site is operated by {config.legalName ?? config.tradingName}.
      </p>

      <H2>Using the site</H2>
      <p>
        Browse it, search it, buy from it. You may not scrape it wholesale,
        attempt to break into it, probe it for vulnerabilities without asking, or
        use it to distribute anything harmful.
      </p>
      <p>
        If you have found a security flaw, we would genuinely like to hear about
        it — see{" "}
        <Link href="/contact" className="text-link underline">
          contact
        </Link>
        . We will not pursue anyone who reports a flaw responsibly and does not
        exploit it beyond what is needed to demonstrate it.
      </p>

      <H2>Accuracy</H2>
      <Ul>
        <li>
          Specifications are supplied by the manufacturer. Where a manufacturer
          revises a product without changing its part number, our page can lag.
          Tell us and we will correct it.
        </li>
        <li>
          Stock figures are live but not reserved until you place an order.
        </li>
        <li>
          Delivery estimates are estimates. Nothing on a product page is a
          contractual promise; the order confirmation is.
        </li>
        <li>
          Product images are placeholder drawings, not photographs of the item.
          Where a real photograph appears it is the manufacturer&apos;s.
        </li>
      </Ul>

      <H2>Reviews</H2>
      <p>
        Reviews are written by customers, not by us. A verified-purchase badge
        means the reviewer&apos;s email matches a delivered order for that item —
        it is awarded by the system, never typed in by hand.
      </p>
      <p>
        We do not delete negative reviews, and we do not write positive ones. We
        will remove a review that is abusive, defamatory, contains someone
        else&apos;s personal data, or is obviously about a different product.
      </p>

      <H2>Intellectual property</H2>
      <p>
        The site&apos;s design, text and code are ours. Product names, logos and
        trade marks belong to their respective owners and appear here because we
        resell their products — their use does not imply any endorsement or
        partnership beyond that.
      </p>

      <H2>Availability</H2>
      <p>
        We aim to keep the site up but do not guarantee it. We may suspend it for
        maintenance without notice. If an outage interrupts an order you have
        already paid for, the order stands — it is recorded in our database, not
        in your browser.
      </p>

      <H2>Links out</H2>
      <p>
        Where we link to a manufacturer or a payment provider, we are not
        responsible for their site or their content.
      </p>

      <H2>Changes</H2>
      <p>
        We may update these terms. The version in force for an order is the one
        published when the order was placed, and every policy page carries the
        date it last changed.
      </p>
    </PolicyPage>
  );
}
