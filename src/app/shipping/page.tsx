import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";
import { STORE_CURRENCY } from "@/lib/money";
import { RESTRICTED_COUNTRIES, ZONES } from "@/lib/shipping";
import { getSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipping & delivery",
  description:
    "Shipping rates by region, delivery estimates, customs clearance and who pays import duty on a Vertex Infosolutions order.",
};

export default function ShippingPage() {
  const config = getSiteConfig();

  return (
    <PolicyPage title="Shipping & delivery" updated="2 September 2026">
      <p>
        Two different things happen after you pay, depending on what you bought.
        Hardware is picked, packed, handed to a carrier and cleared through your
        country&apos;s customs. Software licences are issued to your email
        address and cross no border at all. An order containing both does both,
        independently — one half arriving does not wait on the other.
      </p>

      <H2>Where goods ship from</H2>
      <p>
        All physical goods are dispatched from {config.shipsFrom}. Every parcel
        travels with a commercial invoice showing the HS code, country of origin,
        declared value and weight of each item. Those are the details your
        customs authority assesses duty against, and they are shown on each
        product page before you buy.
      </p>
      <p>
        We declare the price you actually paid. We will not under-declare a
        shipment or mark an order as a gift — it is customs fraud, it voids your
        insurance, and it is the buyer who is left carrying the penalty.
      </p>

      <H2>Rates and delivery times</H2>
      <p>
        Carriage is charged on the shipped part of your basket only. Adding a
        licence to an order never increases its shipping cost. All figures in{" "}
        {STORE_CURRENCY}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] uppercase tracking-wide text-faint">
              <th scope="col" className="py-2 pr-4 font-medium">Region</th>
              <th scope="col" className="py-2 pr-4 font-medium">Shipping</th>
              <th scope="col" className="py-2 pr-4 font-medium">Free over</th>
              <th scope="col" className="py-2 font-medium">Transit</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(ZONES).map((zone) => (
              <tr key={zone.id} className="border-b border-line-soft">
                <td className="py-2 pr-4 text-ink">{zone.label}</td>
                <td className="py-2 pr-4">${zone.shippingMinor / 100}</td>
                <td className="py-2 pr-4">${zone.freeOverMinor / 100}</td>
                <td className="py-2">
                  {zone.transitDays[0]}–{zone.transitDays[1]} business days
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Transit is counted from dispatch, not from the order. Each product page
        shows its own dispatch lead time, and the arrival estimate at checkout
        adds the two together. The range already allows for a normal customs
        hold; it does not allow for an inspection, which nobody can predict.
      </p>

      <H2>Import duty and taxes — who pays</H2>
      <p>
        <strong className="text-ink">You do.</strong> Orders ship DAP (Delivered
        at Place). The price you pay us covers the goods and the carriage.
        Your country then charges its own import duty, VAT, GST or sales tax on
        arrival, and the carrier collects that from you before it hands the
        parcel over.
      </p>
      <p>
        We cannot quote those charges: they depend on your country&apos;s tariff
        schedule, the HS code, the declared value and sometimes on whether you
        are importing as a business or an individual. Your customs broker or
        the carrier can tell you before you order, and we will supply any
        paperwork you need to ask.
      </p>
      <p>
        Refusing to pay the duty does not cancel the order. A parcel refused at
        the border is either destroyed or returned at our cost, and in the
        latter case the return freight and any storage charges come out of the
        refund. This is the single most common cause of a bad cross-border
        purchase, which is why it is stated here rather than in a footnote.
      </p>

      <H2>Where we cannot ship</H2>
      <p>
        IT hardware and licensed software are export-controlled goods. We do not
        supply — physically or electronically — to{" "}
        {RESTRICTED_COUNTRIES.map((c) => c.name).join(", ")}. An order to one of
        those destinations is refused at checkout rather than taken and
        cancelled. See{" "}
        <Link href="/export-compliance" className="text-link underline">
          export compliance
        </Link>
        .
      </p>
      <p>
        Countries outside the list above but absent from our checkout are ones
        we have not yet rated. Email us and we will usually quote through a
        freight forwarder.
      </p>

      <H2>Tracking</H2>
      <p>
        The carrier name and tracking number appear on your order page as soon
        as the parcel is collected, and are emailed to you at the same time.
        Until then the order page says so rather than showing a tracking number
        that does not work yet.
      </p>
      <p>
        Tracking on a cross-border shipment goes quiet for a few days while the
        parcel clears customs. That is normal and not a sign anything is wrong.
        If nothing has moved for more than five business days, contact us and we
        will chase it.
      </p>

      <H2>If something arrives damaged or not at all</H2>
      <Ul>
        <li>
          Damage in transit: tell us within 7 days of delivery with photographs
          of the packaging and the item. We claim against the carrier and
          replace or refund you — you do not have to deal with the carrier.
        </li>
        <li>
          Lost in transit: we open a trace with the carrier. If it is not found
          within their investigation window we replace or refund in full.
        </li>
        <li>
          Delivered but not received: we investigate with the carrier, including
          the proof-of-delivery signature and GPS record.
        </li>
      </Ul>

      <H2>Licences</H2>
      <p>
        Keys are issued the moment payment clears — usually within seconds.
        They appear on your order page and are emailed to the address you gave
        at checkout. No shipment, no customs, no duty, wherever you are.
      </p>
    </PolicyPage>
  );
}
