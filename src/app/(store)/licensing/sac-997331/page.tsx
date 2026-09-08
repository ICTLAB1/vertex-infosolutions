import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";
import { absolute, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "SAC 997331 — the GST code for a software licence",
  description:
    "What SAC 997331 means, why software licences are charged at 18% GST, when a supply is a zero-rated export instead, and what has to appear on the invoice for input credit to be claimed.",
  path: "/licensing/sac-997331",
});

/**
 * The tax question every Indian buyer of software has and nobody answers.
 *
 * It already sits on every invoice this shop issues and is explained nowhere,
 * which is the wrong way round: the person who needs it is an accounts payable
 * clerk deciding whether an invoice can be paid, and they are searching for
 * the code, not for us. Written to be useful to somebody who will never buy
 * anything here — which is what makes it worth linking to.
 */
const FAQ = [
  {
    q: "What is SAC 997331?",
    a: "SAC 997331 is the Services Accounting Code for licensing services for the right to use computer software and databases. It is the code that belongs on a GST invoice for a software licence sold in India. SAC codes classify services the way HSN codes classify goods, and a licence to use software is a service under GST even though nothing physical changes hands.",
  },
  {
    q: "What GST rate applies to SAC 997331?",
    a: "18%, made up of 9% CGST and 9% SGST for a supply within a state, or 18% IGST for a supply between states. There is no lower rate for software and no exemption for buying it electronically.",
  },
  {
    q: "Is GST charged when software is sold to a customer outside India?",
    a: "No. A supply to a recipient outside India, paid for in convertible foreign exchange, is an export of services and is zero-rated under section 16 of the IGST Act. No Indian GST is charged. Any tax the buyer's own country levies on imported software is a separate matter between them and their own authority.",
  },
  {
    q: "Can input tax credit be claimed on a software licence?",
    a: "Yes, where the software is used in the course or furtherance of business and the invoice carries what the rules require: the supplier's GSTIN, the recipient's GSTIN, the SAC, the taxable value and the tax shown separately. An invoice missing the recipient's GSTIN is the usual reason a claim is refused.",
  },
  {
    q: "Does a subscription change the code?",
    a: "No. An annual subscription and a perpetual licence are both licensing services for the right to use software, and both fall under 997331. What changes is when the supply is treated as made — a subscription is invoiced for the term, and the time of supply follows the invoice or the payment, whichever is earlier.",
  },
];

export default function SacPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "@id": `${absolute("/licensing/sac-997331")}#faq`,
            mainEntity: FAQ.map((entry) => ({
              "@type": "Question",
              name: entry.q,
              acceptedAnswer: { "@type": "Answer", text: entry.a },
            })),
          }),
        }}
      />

      <PolicyPage
        title="SAC 997331 — the GST code for a software licence"
        updated="8 September 2026"
      >
        <p>
          <strong className="text-ink">The short answer.</strong> SAC 997331 is
          the Services Accounting Code for licensing services for the right to
          use computer software. It carries GST at 18% on a domestic Indian
          supply, and nothing at all on an export, which is zero-rated. It
          appears on every GST invoice this shop issues.
        </p>
        <p>
          This page exists because the code is on the invoice and explained
          nowhere, and the person who needs it is usually in accounts payable
          deciding whether an invoice can be paid.
        </p>

        <H2>What the code covers</H2>
        <p>
          Group 99733 is licensing services for the right to use intellectual
          property. Within it, 997331 is specifically the right to use computer
          software and databases. A licence to use software is a service under
          GST — the classification does not change because the software is
          downloaded, streamed, delivered by email or assigned in an admin
          console.
        </p>

        <H2>The rate, and how it splits</H2>
        <Ul>
          <li>
            <strong className="text-ink">Within one state.</strong> 9% CGST plus
            9% SGST.
          </li>
          <li>
            <strong className="text-ink">Between states.</strong> 18% IGST.
          </li>
          <li>
            <strong className="text-ink">
              To a recipient outside India, paid in foreign exchange.
            </strong>{" "}
            Zero-rated as an export of services under section 16 of the IGST
            Act. No Indian GST is charged.
          </li>
        </Ul>
        <p>
          Which of those applies is decided by the place of supply and the
          recipient&apos;s location, not by where the software runs or where the
          publisher is. See{" "}
          <Link href="/export-compliance" className="text-link underline">
            export compliance
          </Link>{" "}
          for the export side.
        </p>

        <H2>What has to be on the invoice</H2>
        <p>
          For input tax credit to be claimed, the invoice needs all of this.
          The one most often missing is the third.
        </p>
        <Ul>
          <li>The supplier&apos;s name, address and GSTIN.</li>
          <li>A serially numbered invoice with its date.</li>
          <li>
            The recipient&apos;s name, address and GSTIN — without it, credit is
            refused.
          </li>
          <li>A description of the service and the SAC.</li>
          <li>
            The taxable value, and the tax shown separately as CGST and SGST or
            as IGST.
          </li>
          <li>The place of supply, for an inter-state supply.</li>
        </Ul>
        <p>
          Every Indian invoice from this shop carries all of them, and the GSTIN
          field is asked for at checkout for exactly this reason rather than as
          a formality.
        </p>

        <H2>Questions we are actually asked</H2>
        <div className="space-y-4">
          {FAQ.map((entry) => (
            <div key={entry.q}>
              <h3 className="text-[15px] font-bold text-ink">{entry.q}</h3>
              <p className="mt-1">{entry.a}</p>
            </div>
          ))}
        </div>

        <p className="rounded-md border border-line bg-ground/50 p-4 text-[13px]">
          <strong className="text-ink">This is not tax advice.</strong> It is
          how this shop classifies what it sells and what it puts on its
          invoices, written out so you can check it. Your own position — place
          of supply, eligibility for credit, whether a particular purchase is
          in the course of business — is between you and your accountant.
        </p>

        <p>
          Related:{" "}
          <Link href="/licensing" className="text-link underline">
            how licensing works
          </Link>
          ,{" "}
          <Link href="/terms" className="text-link underline">
            terms of sale
          </Link>
          , and{" "}
          <Link href="/licensing/csp-new-tenant" className="text-link underline">
            why a CSP order creates a new Microsoft tenant
          </Link>
          .
        </p>
      </PolicyPage>
    </>
  );
}
