import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";

export const metadata: Metadata = {
  title: "How licensing works",
  description:
    "What you are actually buying: subscription versus perpetual, named users, seat reassignment, renewals, and how to spot a licence that will stop working.",
};

export default function LicensingPage() {
  return (
    <PolicyPage title="How licensing works" updated="2 September 2026">
      <p>
        Software licensing is where most of the money is lost — not on price,
        but on buying the wrong thing. This page is what we would tell you on
        the phone.
      </p>

      <H2>Subscription or perpetual</H2>
      <Ul>
        <li>
          <strong className="text-ink">Annual subscription.</strong> You have
          the right to use the software for twelve months. When it expires the
          software stops working, or drops to a read-only mode. Microsoft 365,
          Creative Cloud and everything from Autodesk work this way.
        </li>
        <li>
          <strong className="text-ink">Perpetual.</strong> Bought outright, yours
          to keep, no renewal. Windows 11 Pro and Windows Server are perpetual.
          They do not get new versions — a perpetual licence buys the version
          you bought.
        </li>
      </Ul>
      <p>
        A perpetual licence at a similar price to an annual one is not better
        value by default: it is a different thing. Every product page says which
        it is, above the fold.
      </p>

      <H2>Microsoft subscriptions arrive in a new tenant</H2>
      <p>
        Every Microsoft subscription sold here is a CSP subscription, bought in
        the region we trade in. Microsoft will not attach one of those to a
        tenant that already exists in a different region, so it provisions a{" "}
        <strong className="text-ink">new tenant, with a new tenant ID</strong>,
        for your order.
      </p>
      <p>
        This matters more than it sounds. If you already run Microsoft 365, the
        seats you buy here will not appear beside your existing users. They are
        a separate directory: separate sign-ins, separate mailboxes, separate
        SharePoint. Your current tenant is untouched — nothing is migrated,
        merged or moved.
      </p>
      <p>
        If what you want is more seats on the tenant you already have, tell us
        before you order and we will say plainly whether we can do it. Buying
        the wrong one is the expensive mistake this page exists to prevent.
      </p>

      <H2>Named users, not devices</H2>
      <p>
        Adobe and Autodesk licence by named user. A seat belongs to one person,
        identified by their email address, and that person can install on more
        than one machine. It is not a floating licence and it is not a device
        licence: two people cannot share one seat, even at different times of
        day.
      </p>
      <p>
        Windows is the opposite — licensed to the device, not the person, and
        not transferable to another machine once activated.
      </p>

      <H2>Reassigning a seat</H2>
      <p>
        When someone leaves, their seat can be reassigned to their replacement
        through the publisher&apos;s admin console. You do not need to buy
        another one and you do not need us to do it. Adobe and Autodesk both
        allow this; Microsoft 365 seats are reassigned the same way in the 365
        admin centre.
      </p>
      <p>
        Publishers do impose limits — typically not reassigning the same seat
        more than once every ninety days — to stop a single seat being rotated
        around a whole team.
      </p>

      <H2>Renewals</H2>
      <p>
        Nothing bought here renews automatically. We email you a month before
        expiry with the current price, and you decide. If you do nothing, the
        subscription lapses on its end date and the software stops.
      </p>
      <p>
        Renew before the expiry date where you can. Letting a subscription lapse
        and restarting it later is sometimes treated as a new purchase at list
        price rather than a renewal, and with Autodesk in particular that
        difference is substantial.
      </p>

      <H2>Multi-year terms</H2>
      <p>
        Several Autodesk products are meaningfully cheaper on a three-year term
        than on three consecutive annual ones. If you know you are keeping it,
        ask us before buying annual — we will tell you when the multi-year price
        is worth it and when it is not.
      </p>

      <H2>Volume and agreements</H2>
      <p>
        Above ten seats the price on this website is no longer the best one
        available to you, and the licensing programme usually changes too. That
        is not an upsell — a volume agreement genuinely costs less per seat and
        is administratively simpler.{" "}
        <Link href="/contact" className="text-link underline">
          Ask for a quote
        </Link>
        .
      </p>

      <H2>How to spot a licence that will stop working</H2>
      <p>
        Grey-market keys are everywhere and the price is the giveaway. A key at
        a fifth of the prices on this page is one of these:
      </p>
      <Ul>
        <li>
          An education or not-for-profit licence resold commercially, which the
          publisher revokes when it notices.
        </li>
        <li>
          A volume key from a large agreement, split up and resold — revoked
          when the audit happens.
        </li>
        <li>
          A key bought with a stolen card, which is cancelled on chargeback,
          usually two to three months in.
        </li>
        <li>
          A regional licence sold outside its territory, which fails to
          activate or is deactivated later.
        </li>
      </Ul>
      <p>
        In each case the software stops, the money is gone, and you have no
        recourse. We are an authorised reseller and every licence we supply is
        traceable to the publisher, which is most of what you are paying the
        difference for.
      </p>

      <H2>We are the reseller, not the licensor</H2>
      <p>
        The licence is between you and Microsoft, Adobe or Autodesk, on their
        own end-user terms, which you accept when you activate it. We sell it,
        invoice it, and help you when something goes wrong with it. We cannot
        change what it permits, and neither can anyone else selling it.
      </p>
      <p>
        Support for the software itself comes from the publisher. Support for
        the purchase — activation, assignment, invoices, renewals — comes from
        us, and we would rather you asked us first.
      </p>
    </PolicyPage>
  );
}
