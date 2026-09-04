import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/seo";
import { H2, PolicyPage, Ul } from "@/components/policy";
import { getSiteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of sale",
  description:
    "The terms you agree to when buying a licence from Vertex Infosolutions: delivery, payment, refunds, and the publisher's own end-user terms that govern the software itself.",
  path: "/terms",
});

export default async function TermsPage() {
  const config = (await getSiteConfig());
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

      <H2>1. What we sell, and what we are</H2>
      <p>
        We are an authorised reseller of Microsoft, Adobe and Autodesk software
        licences. We are not the licensor. The licence itself is granted to you
        by the publisher, under their own end-user terms, which you accept when
        you activate it. We cannot change what a licence permits.
      </p>
      <p>
        Publisher names and marks appear here because we resell their products.
        That does not imply any endorsement or partnership beyond the reseller
        relationship.
      </p>

      <H2>2. Prices, currency and tax</H2>
      <p>
        The store sells into two markets and they are taxed differently. Which
        one applies is decided by your billing country, and the currency and the
        billing country have to agree — the checkout will not let them differ.
      </p>
      <Ul>
        <li>
          <strong className="text-ink">India, in INR.</strong> A domestic supply
          of services. Displayed prices <em>include</em> GST at 18%, the invoice
          shows the taxable value and the tax separately, and it carries the SAC
          code. Give us your GSTIN at checkout and it goes on the invoice so you
          can claim input credit — it cannot be added afterwards.
        </li>
        <li>
          <strong className="text-ink">Elsewhere, in USD.</strong> An export of
          services, zero-rated. No Indian GST is charged. Whatever your own
          country levies on imported software is between you and it, and is not
          included in the price you pay us.
        </li>
      </Ul>
      <Ul>
        <li>
          The total at checkout is the total we charge. Nothing is added after
          the payment step.
        </li>
        <li>
          INR and USD prices are set independently, not converted. Publishers
          price regions differently and we follow them.
        </li>
        <li>
          Your card issuer may apply its own foreign-exchange rate or an
          international transaction fee. That is between you and your bank.
        </li>
        <li>
          Prices change without notice, but never between your placing an order
          and our accepting it. An order is priced when it is placed.
        </li>
        <li>
          Where a price is obviously wrong — a decimal in the wrong place — we
          cancel and refund rather than supply, and we tell you why.
        </li>
      </Ul>

      <H2>3. Your order</H2>
      <p>
        Placing an order is an offer to buy. The contract forms when we accept
        it, which is when we confirm the order by email. If we cannot fulfil it
        — allocation gone, an export control we cannot clear, a publisher
        restriction in your territory — we cancel and refund in full.
      </p>

      <H2>4. Delivery</H2>
      <p>
        Everything is delivered electronically, to your account and to the email
        address you give at checkout, within one business day of payment
        clearing. Nothing is shipped, so there is no delivery address, no
        carrier and no customs. Bank transfer orders are fulfilled once the
        funds actually clear. Detail in{" "}
        <Link href="/delivery" className="text-link underline">
          how delivery works
        </Link>
        .
      </p>

      <H2>5. Licences</H2>
      <Ul>
        <li>
          A subscription grants use for its term and stops at the end of it. A
          perpetual licence is bought outright and does not include new versions.
        </li>
        <li>
          Named-user licences belong to one person and cannot be shared. Device
          licences are tied to the machine they activate.
        </li>
        <li>
          Nothing renews automatically. You are reminded before expiry and
          renewing is a fresh purchase.
        </li>
        <li>
          Where a licence is restricted to a territory, the product page says so.
          A key you cannot activate in your territory is a fault we refund.
        </li>
      </Ul>

      <H2>6. Refunds</H2>
      <p>
        Full refund before the key is issued. None after it has been revealed,
        because a key cannot be un-issued. A key that will not activate is a
        different matter and we fix or refund it. Full terms in{" "}
        <Link href="/returns" className="text-link underline">
          refunds &amp; cancellations
        </Link>
        .
      </p>

      <H2>7. Payment</H2>
      <p>
        Card, UPI, net banking and PayPal payments are taken on the payment
        provider&apos;s own page. We never see or store your card number, UPI
        PIN or banking credentials. Bank transfer orders are fulfilled once the
        funds clear, and the sending bank&apos;s charges are yours.
      </p>
      <p>
        We may refuse or cancel an order that fails a fraud check, or where
        accepting it would breach an export control. We will always tell you and
        refund in full.
      </p>

      <H2>8. Export control and sanctions</H2>
      <p>
        A licence key is an export even though it travels by email. You confirm
        that you are not ordering on behalf of anyone subject to trade
        sanctions, that the software is not for a prohibited end use, and that
        you will not re-export it in breach of any applicable control. See{" "}
        <Link href="/export-compliance" className="text-link underline">
          export compliance
        </Link>
        .
      </p>

      <H2>9. Liability</H2>
      <p>
        We are responsible for loss you suffer that is a foreseeable result of
        our breaking these terms or failing to use reasonable care. We are not
        responsible for business loss — lost profit, lost data, or lost
        opportunity — and our total liability for any order is limited to what
        you paid for it.
      </p>
      <p>
        We are not liable for the software itself: its performance, its defects
        and its support are the publisher&apos;s under their licence terms.
      </p>
      <p>
        Nothing here limits liability for death or personal injury caused by
        negligence, for fraud, or for anything else that cannot lawfully be
        limited.
      </p>

      <H2>10. Governing law and disputes</H2>
      <p>
        These terms are governed by Indian law and the courts of India have
        jurisdiction — except that, if you are a consumer, you keep the
        protection of the mandatory law of the country you live in and may bring
        proceedings there.
      </p>
      <p>
        Please raise a complaint with us first; it is faster than anything that
        follows it. See{" "}
        <Link href="/contact" className="text-link underline">
          contact &amp; complaints
        </Link>
        .
      </p>

      <H2>11. Electronic records</H2>
      <p>
        This website and its records are electronic records under the Indian
        Information Technology Act, 2000. They do not require a physical or
        digital signature.
      </p>
    </PolicyPage>
  );
}
