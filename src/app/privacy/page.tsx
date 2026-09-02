import type { Metadata } from "next";

import { H2, PolicyPage, Ul } from "@/components/policy";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Vertex Infosolutions collects when you shop, why, and what is never collected.",
};

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy" updated="2 September 2026">
      <p>
        This describes what this website actually collects, which is less than
        you might expect. Where a section says we do not hold something, it is
        because the code genuinely does not store it.
      </p>

      <H2>What we collect when you shop</H2>
      <Ul>
        <li>
          <strong className="text-ink">Your basket.</strong> A cookie holds a
          random token and nothing else — no prices, no products, no identity.
          The basket itself lives on our server against that token, and expires
          after 30 days.
        </li>
        <li>
          <strong className="text-ink">Your order.</strong> Email address, mobile
          number, and — only when something has to be physically delivered — a
          delivery address. An order of licences alone never asks for an address,
          because there is nothing to deliver.
        </li>
        <li>
          <strong className="text-ink">What you bought.</strong> Kept for as long
          as tax law requires, because an invoice has to be reproducible.
        </li>
      </Ul>

      <H2>What we never collect</H2>
      <Ul>
        <li>
          Card numbers, CVVs, UPI PINs or net banking credentials. These are
          entered on the payment gateway&apos;s own page and never reach this
          website. We could not disclose them if we were asked to.
        </li>
        <li>Your GSTIN, unless you ask for a GST invoice and give it to us.</li>
        <li>
          Anything from advertising or analytics trackers. There are none on this
          site.
        </li>
      </Ul>

      <H2>Who else sees it</H2>
      <Ul>
        <li>
          The payment gateway, which needs the order amount and reference to take
          the payment.
        </li>
        <li>
          The courier, which needs the delivery address and mobile number to
          deliver the parcel.
        </li>
        <li>
          The publisher, for a licence that has to be registered to an end user.
        </li>
      </Ul>
      <p>
        Nobody else. We do not sell customer data, and we do not share it for
        marketing.
      </p>

      <H2>Your choices</H2>
      <p>
        You can ask what we hold about you, ask for it to be corrected, or ask
        for it to be deleted. Deletion applies to everything except records tax
        law requires us to keep — we will tell you exactly what has to stay and
        why. Email the grievance officer to make any of these requests.
      </p>

      <H2>Cookies</H2>
      <p>
        One, holding the basket token. It is strictly necessary for the store to
        work, and there is no tracking cookie to consent to.
      </p>
    </PolicyPage>
  );
}
