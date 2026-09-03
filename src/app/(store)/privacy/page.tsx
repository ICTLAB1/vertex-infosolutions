import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/seo";
import { H2, PolicyPage, Ul } from "@/components/policy";
import { getSiteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "What Vertex Infosolutions collects, why, how long it is kept, and who it is shared with. Written to be read rather than to be complied with.",
  path: "/privacy",
});

export default function PrivacyPage() {
  const config = getSiteConfig();

  return (
    <PolicyPage title="Privacy policy" updated="2 September 2026">
      <p>
        This describes what this website actually collects, which is less than
        you might expect. Where a section says we do not hold something, it is
        because the code genuinely does not store it.
      </p>
      <p>
        The data controller is {config.legalName ?? config.tradingName}
        {config.address ? `, ${config.address}` : ""}. Buying from us means your
        data is processed in India, outside the EEA and the UK — what that means
        for you is set out under <em>International transfers</em> below.
      </p>

      <H2>What we collect when you shop</H2>
      <Ul>
        <li>
          <strong className="text-ink">Your basket.</strong> A cookie holds a
          random token and nothing else — no prices, no products, no identity.
          The basket itself lives on our server against that token and expires
          after 30 days.
        </li>
        <li>
          <strong className="text-ink">Your market</strong> — India or
          international — so prices and tax can be shown correctly. Stored
          against the basket and in one cookie, not against you.
        </li>
        <li>
          <strong className="text-ink">Your order.</strong> Email address, phone
          number, and the billing details your invoice is made out to. There is
          no delivery address, because nothing is delivered anywhere but an
          inbox.
        </li>
        <li>
          <strong className="text-ink">Your GSTIN</strong>, if you are an Indian
          business and choose to give one, so it can appear on the tax invoice.
        </li>
        <li>
          <strong className="text-ink">What you bought</strong>, kept for as long
          as tax law requires, because an invoice has to be reproducible years
          later.
        </li>
        <li>
          <strong className="text-ink">
            Your IP address, but only when a sign-in fails.
          </strong>{" "}
          It is recorded with the address that was typed, and deleted an hour
          later or the moment a sign-in succeeds — whichever comes first. It is
          there to slow down somebody guessing passwords, and it is not kept
          for successful sign-ins, so this is not a record of when or where you
          logged in.
        </li>
      </Ul>

      <H2>What we never collect</H2>
      <Ul>
        <li>
          Card numbers, CVVs or PayPal credentials. These are entered on the
          payment provider&apos;s own page and never reach this website. We could
          not disclose them if we were asked to.
        </li>
        <li>Analytics or advertising identifiers. There are no trackers on this site.</li>
        <li>Anything about you from a third-party data broker.</li>
      </Ul>

      <H2>Why we are allowed to hold it</H2>
      <Ul>
        <li>
          <strong className="text-ink">To perform the contract</strong> — we
          cannot issue a licence without an email address, or invoice you
          without a name and a country.
        </li>
        <li>
          <strong className="text-ink">To comply with a legal obligation</strong>{" "}
          — GST invoices, export records and the sanctions screening every
          order goes through.
        </li>
        <li>
          <strong className="text-ink">Legitimate interests</strong> — preventing
          fraud, and answering you when you contact us.
        </li>
      </Ul>
      <p>
        We do not rely on consent for any of it, because we do not do the things
        consent would be needed for.
      </p>

      <H2>Who else sees it</H2>
      <Ul>
        <li>
          The payment provider, which needs the order amount and reference to
          take the payment.
        </li>
        <li>
          The publisher — Microsoft, Adobe or Autodesk — for a licence that has
          to be registered or assigned to a named end user. They receive the
          email address the seat is assigned to and nothing more.
        </li>
        <li>
          Microsoft Azure, which hosts this website and its database on our
          behalf.
        </li>
      </Ul>
      <p>
        Nobody else. We do not sell personal data, we do not share it for
        advertising, and we have never done either.
      </p>

      <H2>International transfers</H2>
      <p>
        Your data is processed in India. If you are in the EEA or the UK, that
        is a transfer to a country without an adequacy decision, and we rely on
        the Standard Contractual Clauses for it. Ask us and we will send you a
        copy of the safeguards in place.
      </p>

      <H2>How long we keep it</H2>
      <Ul>
        <li>Baskets: 30 days.</li>
        <li>
          Orders and invoices: eight years, which is what Indian tax law
          requires for GST records and export documentation.
        </li>
        <li>
          Support correspondence: three years from the last message.
        </li>
      </Ul>

      <H2>Your rights</H2>
      <p>
        Wherever you live, you can ask us what we hold about you, ask for it to
        be corrected, ask for a copy in a portable format, or ask for it to be
        deleted. If you are in the EEA or the UK you also have the right to
        object to processing and to complain to your local supervisory
        authority. If you are in California you may ask what we disclosed and to
        whom, and the answer is the list above.
      </p>
      <p>
        Deletion applies to everything except records that tax law requires us
        to keep — we will tell you exactly what has to stay and why.
        We answer within 30 days.
      </p>
      <p>
        Email{" "}
        {config.complaintsEmail ? (
          <a href={`mailto:${config.complaintsEmail}`} className="text-link underline">
            {config.complaintsEmail}
          </a>
        ) : (
          "our contact address"
        )}{" "}
        to make any of these requests, or see{" "}
        <Link href="/contact" className="text-link underline">
          contact &amp; complaints
        </Link>
        .
      </p>

      <H2>Cookies</H2>
      <p>
        Two: one holding the basket token, one remembering whether you chose
        INR or USD. Both are strictly necessary for the store to work and there
        is no tracking cookie to consent to. Detail in the{" "}
        <Link href="/cookies" className="text-link underline">
          cookie policy
        </Link>
        .
      </p>

      <H2>Security</H2>
      <p>
        The site is served over HTTPS, the database is encrypted at rest and
        reachable only from the application, and the basket cookie is
        HTTP-only so no script on the page can read it. If we ever suffer a
        breach that puts you at risk, we will tell you and the relevant
        regulator within 72 hours.
      </p>
    </PolicyPage>
  );
}
