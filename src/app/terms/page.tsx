import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";
import { STORE_CURRENCY } from "@/lib/money";
import { getSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of sale",
  description:
    "The terms on which Vertex Infosolutions sells hardware and software licences to customers outside India.",
};

export default function TermsPage() {
  const config = getSiteConfig();
  const seller = config.legalName ?? config.tradingName;

  return (
    <PolicyPage title="Terms of sale" updated="2 September 2026">
      <p>
        These terms apply to everything bought through this website. They are
        written to be read rather than to be impenetrable; where a term matters
        to you it is stated plainly. Your order is with {seller}
        {config.address ? `, ${config.address}` : ""}.
      </p>
      <p>
        Nothing here reduces a mandatory consumer right you have where you live.
        Where your local law gives you more than these terms do, your local law
        applies.
      </p>

      <H2>1. Prices</H2>
      <Ul>
        <li>
          Every price is in {STORE_CURRENCY} and excludes shipping, import duty
          and any tax your country charges on arrival.
        </li>
        <li>
          The total at checkout is the total we charge. Nothing is added after
          the payment step.
        </li>
        <li>
          Your card issuer may apply its own foreign-exchange rate or an
          international transaction fee. That is between you and your bank; the
          amount we charge is the amount shown.
        </li>
        <li>
          Prices change without notice, but never between your placing an order
          and our accepting it. An order is priced when it is placed.
        </li>
        <li>
          Where a price is obviously wrong — a decimal in the wrong place — we
          will cancel and refund rather than deliver, and we will tell you why.
        </li>
      </Ul>

      <H2>2. Your order</H2>
      <p>
        Placing an order is an offer to buy. The contract forms when we accept
        it, which is when we confirm the order by email. If we cannot fulfil an
        order — stock gone, a destination we cannot reach, an export control we
        cannot clear — we cancel it and refund in full.
      </p>
      <p>Stock is committed to your order when you place it, not when it ships.</p>

      <H2>3. Delivery, title and risk</H2>
      <Ul>
        <li>
          Goods ship DAP (Delivered at Place). We arrange and pay for carriage;
          you are the importer of record and pay import duty and destination
          taxes.
        </li>
        <li>
          Risk passes to you on delivery. Title passes when we have received
          payment in full.
        </li>
        <li>
          Delivery dates are estimates made in good faith and calculated
          conservatively. They are not guarantees, and a customs inspection is
          outside anyone&apos;s control. We tell you as soon as we know a date
          has slipped.
        </li>
      </Ul>
      <p>
        Full detail in{" "}
        <Link href="/shipping" className="text-link underline">
          shipping &amp; delivery
        </Link>
        .
      </p>

      <H2>4. Software licences</H2>
      <Ul>
        <li>
          A licence is supplied under the publisher&apos;s own end-user terms,
          which you accept when you activate it. We are the reseller, not the
          licensor.
        </li>
        <li>
          Keys are issued once payment clears and are not returnable once
          revealed.
        </li>
        <li>
          Subscriptions do not auto-renew through this website. You are reminded
          before expiry, and renewing is a fresh purchase.
        </li>
        <li>
          Some licences are region-locked by the publisher. Where that applies it
          is stated on the product page; buying a key you cannot activate in your
          territory is a fault we will refund.
        </li>
      </Ul>

      <H2>5. Warranty</H2>
      <p>
        Hardware carries the manufacturer&apos;s warranty stated on the product
        page. Check whether it is an international warranty before you buy —
        some are honoured only in the country of first sale, and where that is
        the case we say so. See{" "}
        <Link href="/warranty" className="text-link underline">
          warranty
        </Link>
        .
      </p>

      <H2>6. Payment</H2>
      <p>
        Card and PayPal payments are taken on the payment provider&apos;s own
        page. We never see or store your card number or your PayPal credentials.
        Bank transfer orders are prepared once the funds clear and the bank
        charges of the sending bank are yours.
      </p>
      <p>
        We may refuse or cancel an order where a payment fails a fraud check,
        where the delivery address cannot be verified, or where accepting it
        would breach an export control. We will always tell you and refund in
        full.
      </p>

      <H2>7. Export control and sanctions</H2>
      <p>
        You confirm that you are not ordering on behalf of anyone subject to
        trade sanctions, that the goods are not for a prohibited end use, and
        that you will not re-export them in breach of any applicable control.
        See{" "}
        <Link href="/export-compliance" className="text-link underline">
          export compliance
        </Link>
        .
      </p>

      <H2>8. Liability</H2>
      <p>
        We are responsible for loss you suffer that is a foreseeable result of
        our breaking these terms or failing to use reasonable care. We are not
        responsible for business loss — lost profit, lost data, or lost
        opportunity — and our total liability for any order is limited to what
        you paid for it.
      </p>
      <p>
        Nothing here limits liability for death or personal injury caused by
        negligence, for fraud, or for anything else that cannot lawfully be
        limited.
      </p>

      <H2>9. Governing law and disputes</H2>
      <p>
        These terms are governed by Indian law and the courts of India have
        jurisdiction — except that, if you are a consumer, you keep the
        protection of the mandatory law of the country you live in and may bring
        proceedings there.
      </p>
      <p>
        Please raise a complaint with us first. It is faster than anything that
        follows it, and most disputes turn out to be a misunderstanding about
        customs. See{" "}
        <Link href="/contact" className="text-link underline">
          contact &amp; complaints
        </Link>
        .
      </p>

      <H2>10. Electronic records</H2>
      <p>
        This website and its records are electronic records under the Indian
        Information Technology Act, 2000. They do not require a physical or
        digital signature.
      </p>
    </PolicyPage>
  );
}
