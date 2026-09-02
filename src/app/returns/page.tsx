import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";

export const metadata: Metadata = {
  title: "Refunds & cancellations",
  description:
    "When a software licence can be refunded, when it cannot, and how the money comes back.",
};

export default function ReturnsPage() {
  return (
    <PolicyPage title="Refunds & cancellations" updated="2 September 2026">
      <p>
        There is nothing to post back — every product here is a licence. So the
        question is not whether you can return it, but whether the key has been
        revealed.
      </p>

      <H2>The rule, in one line</H2>
      <p className="rounded-md border border-line bg-ground/50 p-4 text-ink">
        <strong>Before the key is issued: refunded in full, no questions.</strong>{" "}
        Once the key has been shown to you or assigned to your account, it has
        been transferred and cannot be taken back.
      </p>
      <p>
        This is not us being difficult. A licence key cannot be un-issued: once
        you have seen it, it can be redeemed, and the publisher has already
        counted it against our allocation. Anyone promising otherwise is either
        absorbing the loss or reselling your key to somebody else.
      </p>

      <H2>Full refund — always</H2>
      <Ul>
        <li>
          You paid by bank transfer and cancel before the funds clear and the
          keys are issued.
        </li>
        <li>
          We could not fulfil the order — allocation gone, an export control we
          could not clear, a publisher restriction in your territory.
        </li>
        <li>
          The key does not activate and we cannot resolve it with the publisher.
          A dead licence is not a licence.
        </li>
        <li>
          You were sold the wrong product because our page described it wrongly.
          That is our error, not your mistake.
        </li>
      </Ul>

      <H2>When a key does not activate</H2>
      <p>
        Contact us. This is a problem to fix, not a refund to argue about. We
        will either resolve the activation with the publisher or issue a
        replacement key at no cost. We only refund if neither works.
      </p>
      <p>
        Activation failures are almost always one of three things: a region
        mismatch, a key already redeemed against another account, or a product
        that needs to be assigned in an admin console rather than typed in. All
        three are ours to sort out.
      </p>

      <H2>Buying the wrong thing</H2>
      <p>
        If you ordered an annual subscription and meant perpetual, or bought
        AutoCAD LT when you needed full AutoCAD, tell us before you redeem the
        key and we will exchange it. Once redeemed, the publisher counts it as
        used and we cannot.
      </p>
      <p>
        Which is why{" "}
        <Link href="/licensing" className="text-link underline">
          how licensing works
        </Link>{" "}
        exists, and why we would rather answer a question before you buy.
      </p>

      <H2>Your statutory right to cancel</H2>
      <p>
        Consumers in the EU and the UK have a fourteen-day right to cancel a
        distance purchase. That right is waived for digital content once
        delivery begins with your express consent — which is exactly what
        happens when you ask for a key and we issue it in seconds.
      </p>
      <p>
        We tell you this at checkout rather than in a clause you never read,
        because a right given up without noticing is not a fair bargain. If you
        would rather keep the cancellation right, choose bank transfer: nothing
        is issued until the funds clear, and you can cancel in the meantime.
      </p>
      <p>
        Indian consumers keep every right the Consumer Protection Act gives
        them; nothing here reduces it.
      </p>

      <H2>How a refund is paid</H2>
      <p>
        Back to where the money came from — the same card, the same UPI account,
        the same PayPal account, the same bank account. We cannot redirect a
        refund elsewhere, and anyone asking you to accept one by a different
        route is not us.
      </p>
      <p>
        Refunds are issued in the currency you paid in, for the amount you paid.
        A foreign-exchange margin or an international transaction fee applied by
        your own bank was the bank&apos;s charge and we cannot reimburse it —
        the amount that leaves us is the amount that reached us.
      </p>
      <p>
        On an Indian order the GST is refunded with the rest; we reverse it in
        our own return. If you have already claimed input credit on it, your
        accounts team will need to reverse that too.
      </p>

      <H2>How long it takes</H2>
      <Ul>
        <li>We initiate within two business days of agreeing the refund.</li>
        <li>
          UPI and net banking: usually same day to three business days.
        </li>
        <li>
          Cards: five to ten business days, longer across a border. That window
          is the bank&apos;s, not ours.
        </li>
      </Ul>

      <H2>Starting one</H2>
      <p>
        Find your order and email us with the order number and what went wrong.
        You will get an answer within one business day. There is no automated
        refunds portal, and we would rather say so than point you at a button
        that opens a contact form.
      </p>
    </PolicyPage>
  );
}
