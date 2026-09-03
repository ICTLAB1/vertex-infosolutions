import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/seo";
import { H2, PolicyPage, Ul } from "@/components/policy";
import { getSiteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact Vertex Infosolutions",
  description:
    "Ask about licensing before you buy, request a volume quote, or get help with an order. Email and phone support from an authorised Microsoft, Adobe and Autodesk reseller.",
  path: "/contact",
});

export default function ContactPage() {
  const config = getSiteConfig();

  return (
    <PolicyPage title="Contact & complaints" updated="2 September 2026">
      <p>
        A cross-border buyer cannot walk into the shop, so here is everything
        needed to reach a person, and what to expect when you do.
      </p>

      <H2>Who we are</H2>
      <div className="rounded-md border border-line bg-ground/50 p-4 text-ink">
        <p className="font-semibold">
          {config.legalName ?? config.tradingName}
        </p>
        {config.address ? <p className="text-muted">{config.address}</p> : null}
        <p className="mt-2 font-mono text-[13px] text-muted">
          {config.taxIdNumber ? (
            <span className="mr-4">
              {config.taxIdLabel} {config.taxIdNumber}
            </span>
          ) : null}
          {config.registrationNumber ? (
            <span>
              {config.registrationLabel} {config.registrationNumber}
            </span>
          ) : null}
        </p>
      </div>

      <H2>Getting in touch</H2>
      <Ul>
        {config.supportEmail ? (
          <li>
            Email:{" "}
            <a
              href={`mailto:${config.supportEmail}`}
              className="text-link underline"
            >
              {config.supportEmail}
            </a>{" "}
            — the fastest route, and the one that leaves a record.
          </li>
        ) : null}
        {config.supportPhone ? (
          <li>
            Phone: <span className="text-ink">{config.supportPhone}</span>
          </li>
        ) : null}
        <li>{config.supportHours}</li>
      </Ul>
      <p>
        Hours are given in UTC as well as local time because most of our
        customers are in another timezone. An email sent outside those hours is
        answered the next working morning, not days later.
      </p>

      <H2>What to include</H2>
      <Ul>
        <li>Your order number, if you have one.</li>
        <li>The email address the order was placed with.</li>
        <li>What went wrong, and what you would like done about it.</li>
        <li>
          Photographs, if something arrived damaged — of the packaging as well as
          the item, because the carrier claim needs both.
        </li>
      </Ul>

      <H2>How long we take</H2>
      <Ul>
        <li>Acknowledgement within one business day.</li>
        <li>
          A substantive answer within three business days. Where a claim depends
          on a carrier investigation it takes longer, and we will tell you that
          rather than go quiet.
        </li>
        <li>Resolution of a complaint within 30 days.</li>
      </Ul>

      <H2>Escalating</H2>
      {config.complaintsName ? (
        <>
          <p>
            If the answer you got has not resolved it, escalate to the person
            responsible for complaints:
          </p>
          <div className="rounded-md border border-line bg-ground/50 p-4 text-ink">
            <p className="font-semibold">{config.complaintsName}</p>
            {config.complaintsEmail ? (
              <p>
                <a
                  href={`mailto:${config.complaintsEmail}`}
                  className="text-link underline"
                >
                  {config.complaintsEmail}
                </a>
              </p>
            ) : null}
          </div>
          <p>
            Escalation gets you a more senior answer, not a faster one. Ordinary
            support is quicker for anything routine, because the person answering
            can see your order.
          </p>
        </>
      ) : (
        <p className="rounded-md border border-warn/40 bg-warn/5 p-4 text-warn">
          A complaints contact has not been configured for this deployment. This
          has to be filled in before the store takes a real order.
        </p>
      )}

      <H2>If we still cannot agree</H2>
      <p>
        Consumers in the EEA and the UK may refer a dispute to an alternative
        dispute resolution body in their own country. Wherever you are, you keep
        every right your local consumer law gives you — see{" "}
        <Link href="/terms" className="text-link underline">
          terms of sale
        </Link>
        .
      </p>

      <H2>Security reports</H2>
      <p>
        Found a vulnerability in this website? Email the address above with
        &ldquo;security&rdquo; in the subject. We will acknowledge within one
        business day and will not pursue anyone who reports responsibly.
      </p>
    </PolicyPage>
  );
}
