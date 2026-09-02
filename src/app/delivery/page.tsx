import type { Metadata } from "next";

import { H2, PolicyPage, Ul } from "@/components/policy";
import {
  FLAT_SHIPPING_MINOR,
  FREE_SHIPPING_THRESHOLD_MINOR,
} from "@/lib/delivery";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Delivery",
  description:
    "How Vertex Infosolutions calculates delivery charges, delivery dates and serviceable pincodes.",
};

export default function DeliveryPage() {
  return (
    <PolicyPage title="Delivery" updated="2 September 2026">
      <p>
        Two different things happen after you pay, depending on what you bought.
        Hardware is picked, packed and handed to a courier. Software licences
        are issued to your email address. An order containing both does both, at
        the same time and independently — one half arriving does not wait on the
        other.
      </p>

      <H2>What delivery costs</H2>
      <Ul>
        <li>
          Free on orders where the shipped items come to{" "}
          {formatMoney(FREE_SHIPPING_THRESHOLD_MINOR)} or more.
        </li>
        <li>
          A flat {formatMoney(FLAT_SHIPPING_MINOR)} below that.
        </li>
        <li>
          Nothing at all on licences. If your order is licences only, there is
          no delivery charge and no address to enter.
        </li>
      </Ul>
      <p>
        The charge is calculated on the shipped part of your basket alone. Adding
        a licence to an order never increases its delivery cost.
      </p>

      <H2>How the delivery date is worked out</H2>
      <p>
        The date shown on a product page and at checkout is the supplier&apos;s
        lead time plus transit, counted in working days, with couriers assumed
        to run six days a week. Metro pincodes are given two days of transit and
        everywhere else four.
      </p>
      <p>
        It is deliberately cautious. We would rather arrive early than explain a
        missed date, so the estimate does not assume everything goes right.
      </p>

      <H2>Where we deliver</H2>
      <p>
        Most of the country, but not all of it yet. Your pincode is checked at
        checkout before you pay, not after — if we cannot reach you, you will be
        told at the address step, while there is still something you can do
        about it. Call us in that case and we will usually arrange a courier
        manually.
      </p>

      <H2>When it has shipped</H2>
      <p>
        The courier name and tracking number appear on your order page as soon as
        the parcel is collected, and are emailed to you at the same time. Until
        then the order page says so rather than showing a tracking number that
        does not work yet.
      </p>

      <H2>Licences</H2>
      <p>
        Keys are issued the moment payment clears — usually within seconds. They
        appear on your order page and are emailed to the address you gave at
        checkout. If the email has not arrived within a few minutes, check the
        spam folder before calling; the key is on your order page either way.
      </p>
      <p>
        Cash on delivery is not offered on orders containing a licence, because
        there is nothing for a courier to hand over.
      </p>
    </PolicyPage>
  );
}
