import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";

export const metadata: Metadata = {
  title: "Returns & refunds",
  description:
    "What can be returned to Vertex Infosolutions, within what window, who pays the return freight, and how refunds are paid back.",
};

export default function ReturnsPage() {
  return (
    <PolicyPage title="Returns & refunds" updated="2 September 2026">
      <p>
        Hardware can come back. Licences generally cannot. That distinction is
        not us being difficult — a licence key, once revealed, has been
        transferred and cannot be un-issued.
      </p>
      <p>
        Returning something across a border costs real money and takes real
        time, so this page is specific about who pays for what. Nothing here
        reduces any statutory right you have where you live; where your local
        law gives you more than this policy does, your local law wins.
      </p>

      <H2>Hardware — 14 days</H2>
      <Ul>
        <li>
          Fourteen days from delivery to tell us you want to return something,
          and a further fourteen to get it back to us.
        </li>
        <li>
          It must be unopened, undamaged, and complete with all accessories and
          the original packaging. Opened but unused is usually acceptable; we
          will tell you before you ship it.
        </li>
        <li>
          Tell us first. A parcel that arrives without a return reference cannot
          be matched to an order and delays your refund by weeks.
        </li>
      </Ul>

      <H2>Who pays the return freight</H2>
      <Ul>
        <li>
          <strong className="text-ink">Our error — we pay.</strong> Wrong item,
          damaged in transit, dead on arrival, or not as described. We send a
          prepaid label or arrange a collection.
        </li>
        <li>
          <strong className="text-ink">Change of mind — you pay.</strong>{" "}
          International return freight is expensive and on a low-value item it
          can exceed what you paid. We will tell you the likely cost before you
          commit, so you can decide with the number in front of you.
        </li>
      </Ul>
      <p>
        Import duty you already paid to your own customs authority is not ours
        to refund — we never received it. Most countries will refund it on a
        re-export, and we supply the paperwork you need to claim it. Ask us and
        we will send it.
      </p>

      <H2>Faulty on arrival</H2>
      <p>
        A dead-on-arrival item is replaced rather than refunded, unless you ask
        for a refund. Tell us within 7 days of delivery. We cover freight both
        ways and do not ask you to deal with the manufacturer — that is what a
        reseller is for.
      </p>
      <p>
        A fault that appears later is a warranty matter rather than a return.
        See{" "}
        <Link href="/warranty" className="text-link underline">
          warranty
        </Link>
        .
      </p>

      <H2>Licences</H2>
      <p>
        A licence is not returnable once the key has been revealed on your order
        page or sent to you. Before that point — an order placed but not yet
        issued — it can be cancelled in full.
      </p>
      <p>
        If a key does not activate, that is a different problem and we will fix
        it: contact us and we will either resolve the activation with the
        publisher or issue a replacement key at no cost.
      </p>
      <p>
        Where you have a statutory right to cancel a digital purchase — the EU
        and UK distance-selling rules, among others — that right is waived when
        you ask for immediate delivery and the key is issued. We say so at
        checkout, because a right you gave up without noticing is not a fair
        bargain.
      </p>

      <H2>How a refund is paid</H2>
      <p>
        Back to where the money came from. A card payment is refunded to the
        same card, a PayPal payment to the same PayPal account, a bank transfer
        to the account it came from. We cannot redirect a refund somewhere else,
        and anyone asking you to accept a refund by a different route is not us.
      </p>
      <p>
        Refunds are issued in {""}
        the currency you paid in, for the amount you paid. If your bank applied
        a foreign-exchange margin or an international transaction fee, that was
        the bank&apos;s charge and we cannot reimburse it — the amount that
        leaves us is the amount that reached us.
      </p>
      <p>
        We initiate the refund within two business days of the returned item
        reaching us and passing inspection. How long it takes to appear after
        that is your bank&apos;s to decide, typically five to ten business days
        for a cross-border card refund.
      </p>

      <H2>A mixed order</H2>
      <p>
        Returning the hardware from an order does not cancel the licences on the
        same order, and the refund covers the returned lines only. Your order
        page shows which lines are returnable and which are not, per item.
      </p>
      <p>
        Where free shipping was applied because the order passed a threshold and
        a return takes it back below that threshold, the shipping we absorbed is
        deducted from the refund. This is stated rather than done quietly.
      </p>

      <H2>Starting a return</H2>
      <p>
        Find your order, then email us with the order number and what is wrong.
        You get a return reference and instructions within two business days.
        There is no automated returns portal yet, and we would rather say so
        than point you at a button that opens a contact form.
      </p>
    </PolicyPage>
  );
}
