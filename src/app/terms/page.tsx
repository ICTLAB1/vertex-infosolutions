import type { Metadata } from "next";

import { H2, PolicyPage, Ul } from "@/components/policy";

export const metadata: Metadata = {
  title: "Terms of sale",
  description:
    "The terms on which Vertex Infosolutions sells hardware and software licences online.",
};

export default function TermsPage() {
  return (
    <PolicyPage title="Terms of sale" updated="2 September 2026">
      <p>
        These terms apply to anything bought through this website. They are
        written to be read rather than to be impenetrable; where a term matters
        to you it is stated plainly.
      </p>

      <H2>Prices</H2>
      <Ul>
        <li>
          Every price shown includes GST, at the rate applicable to that item.
          The GST component is stated on the product page and broken out on the
          invoice.
        </li>
        <li>
          The price you pay is the price shown at checkout. Nothing is added
          after the payment step.
        </li>
        <li>
          Prices can change without notice, but never between your placing an
          order and our accepting it. An order is priced when it is placed.
        </li>
        <li>
          Where a price is obviously wrong — a decimal place in the wrong
          position — we will cancel and refund rather than deliver, and we will
          tell you why.
        </li>
      </Ul>

      <H2>Your order</H2>
      <p>
        Placing an order is an offer to buy. The contract forms when we accept
        it, which is when we confirm the order. If we cannot fulfil an order —
        stock gone, a pincode we cannot reach — we will cancel it and refund in
        full.
      </p>
      <p>
        Stock is committed to your order when you place it, not when it ships.
      </p>

      <H2>Software licences</H2>
      <Ul>
        <li>
          A licence is supplied under the publisher&apos;s own terms, which you
          accept when you activate it. We are the reseller, not the licensor.
        </li>
        <li>
          Keys are issued once payment clears, and are not returnable once
          revealed.
        </li>
        <li>
          Subscriptions do not renew automatically through this website. You will
          be reminded before expiry, and renewing is a fresh purchase.
        </li>
      </Ul>

      <H2>Delivery and risk</H2>
      <p>
        Risk in physical goods passes to you on delivery. Delivery dates are
        estimates made in good faith and calculated conservatively; they are not
        guarantees, and we will tell you as soon as we know a date has slipped.
      </p>

      <H2>Warranty</H2>
      <p>
        Hardware carries the manufacturer&apos;s warranty, stated on each product
        page. We will help you make a warranty claim, but the warranty is the
        manufacturer&apos;s and is honoured through their service network. Nothing
        here affects your statutory rights under Indian consumer law.
      </p>

      <H2>Payment</H2>
      <p>
        Card, UPI and net banking payments are taken on the payment
        gateway&apos;s own page. We never see or store your card number, UPI PIN
        or banking credentials. Cash on delivery, where offered, is collected by
        the courier.
      </p>

      <H2>Electronic records</H2>
      <p>
        This website and its records are electronic records under the Information
        Technology Act, 2000. They do not require a physical or digital
        signature.
      </p>

      <H2>Disputes</H2>
      <p>
        Indian law applies. Please raise a complaint through the grievance
        process first — it is faster than anything that follows it.
      </p>
    </PolicyPage>
  );
}
