import type { Metadata } from "next";

import { H2, PolicyPage, Ul } from "@/components/policy";

export const metadata: Metadata = {
  title: "Returns and refunds",
  description:
    "What can be returned to Vertex Infosolutions, within what window, and how refunds are paid back.",
};

export default function ReturnsPage() {
  return (
    <PolicyPage title="Returns and refunds" updated="2 September 2026">
      <p>
        Hardware can come back. Licences generally cannot. That distinction is
        not us being difficult — a licence key, once revealed, has been
        transferred and cannot be un-issued.
      </p>

      <H2>Hardware</H2>
      <Ul>
        <li>
          Seven days from delivery, provided the item is unopened, undamaged and
          in its original packaging with all accessories.
        </li>
        <li>
          Collected from the delivery address at our cost when the return is our
          error — wrong item, damaged in transit, dead on arrival.
        </li>
        <li>
          Return freight is deducted when the item is simply not wanted.
        </li>
        <li>
          A dead-on-arrival item is replaced rather than refunded, unless you
          ask for a refund.
        </li>
      </Ul>

      <H2>Licences</H2>
      <p>
        A licence is not returnable once the key has been revealed on your order
        page or sent to you. Before that point — an order placed but not yet
        issued — it can be cancelled in full.
      </p>
      <p>
        If a key does not activate, that is a different problem and we will fix
        it: contact us and we will either resolve the activation with the
        publisher or issue a replacement key.
      </p>

      <H2>How a refund is paid</H2>
      <p>
        Back to where the money came from. A card payment is refunded to the same
        card, a UPI payment to the same account. We cannot redirect a refund to a
        different account, and anyone asking you to accept a refund somewhere
        else is not us.
      </p>
      <p>
        Refunds are initiated within two working days of the returned item
        reaching us and passing inspection. How long it takes to appear after
        that is the bank&apos;s to decide, typically five to seven working days.
      </p>

      <H2>A mixed order</H2>
      <p>
        Returning the hardware from an order does not cancel the licences on the
        same order, and the refund covers the returned lines only. Your order
        page shows which lines are returnable and which are not, per item.
      </p>

      <H2>Starting a return</H2>
      <p>
        Find your order, then call or email us with the order number. A pickup is
        arranged within two working days. There is no automated returns portal
        yet, and we would rather say so than point you at a button that opens a
        contact form.
      </p>
    </PolicyPage>
  );
}
