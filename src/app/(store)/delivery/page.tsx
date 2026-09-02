import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";

export const metadata: Metadata = {
  title: "How delivery works",
  description:
    "Every licence is delivered by email. What arrives, how fast, what to do if it does not, and why nothing ships.",
};

export default function DeliveryPage() {
  return (
    <PolicyPage title="How delivery works" updated="2 September 2026">
      <p>
        Nothing here is posted to you. Every product on this site is a software
        licence, and a licence is a key, an account assignment or a licence file
        — all of which arrive by email. There is no parcel, no carrier, no
        customs, no duty and no delivery address to enter.
      </p>

      <H2>What arrives, and when</H2>
      <p>
        As soon as the payment confirms, usually within a minute. Two things
        happen at once: the keys appear on your order page, and the same
        details are emailed to the address you gave at checkout.
      </p>
      <Ul>
        <li>
          <strong className="text-ink">Microsoft</strong> — a product key you
          redeem, or seats added to your Microsoft 365 tenant.
        </li>
        <li>
          <strong className="text-ink">Adobe</strong> — seats assigned to your
          Adobe Admin Console, which you then allocate to named users.
        </li>
        <li>
          <strong className="text-ink">Autodesk</strong> — subscriptions
          assigned to your Autodesk account, which you allocate to named users.
        </li>
      </Ul>
      <p>
        For Adobe and Autodesk we need the email address of your existing admin
        account, or we create one. If you have not told us at checkout we will
        ask before assigning — which is the only case where delivery takes
        longer than a minute.
      </p>

      <H2>If the email has not arrived</H2>
      <p>
        Check the spam folder first: an email carrying a long alphanumeric key
        is a shape that filters dislike. If it is not there, your keys are on
        your order page regardless — find it with your order number and the
        email address you used. The email is a convenience; the order page is
        the record.
      </p>
      <p>
        If neither shows anything within fifteen minutes of a successful
        payment, contact us. Do not place a second order.
      </p>

      <H2>Bank transfer is different</H2>
      <p>
        Card, UPI, net banking and PayPal all confirm in seconds. A bank
        transfer does not: we issue keys once the funds actually clear, which is
        usually two to four business days and longer across a border. The order
        page shows &ldquo;Awaiting payment&rdquo; until then, so there is never
        any doubt about which state it is in.
      </p>

      <H2>Nothing renews automatically</H2>
      <p>
        A subscription bought here does not silently roll over. We email you a
        month before it expires, and renewing is a fresh purchase you decide to
        make. This costs us renewals and we do it anyway, because an unexpected
        annual charge is the single most common complaint about buying software
        online.
      </p>

      <H2>Where we cannot supply</H2>
      <p>
        A licence key is an export even though it travels by email, and there
        are countries we cannot supply at all. An order to one of them is
        refused at checkout rather than taken and cancelled — see{" "}
        <Link href="/export-compliance" className="text-link underline">
          export compliance
        </Link>
        .
      </p>

      <H2>Related</H2>
      <p>
        What the licence actually permits, how seats are reassigned, and what
        happens at renewal are all in{" "}
        <Link href="/licensing" className="text-link underline">
          how licensing works
        </Link>
        .
      </p>
    </PolicyPage>
  );
}
