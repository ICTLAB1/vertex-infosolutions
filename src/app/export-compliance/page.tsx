import type { Metadata } from "next";

import { H2, PolicyPage, Ul } from "@/components/policy";
import { RESTRICTED_COUNTRIES } from "@/lib/shipping";
import { getSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Export compliance",
  description:
    "Which destinations Vertex Infosolutions cannot supply, what you confirm when you order, and why we will not under-declare a shipment.",
};

export default function ExportCompliancePage() {
  const config = getSiteConfig();
  const blocked = RESTRICTED_COUNTRIES.map((c) => c.name);

  return (
    <PolicyPage title="Export compliance" updated="2 September 2026">
      <p>
        IT hardware and licensed software are controlled goods. Selling them
        across a border is subject to export controls and trade sanctions, and
        breaking those is a criminal matter rather than a commercial one — for
        us as the exporter and, in some cases, for you as the importer.
      </p>
      <p>
        This page exists so nothing here is a surprise. It is a summary of how we
        operate, not legal advice on your own obligations.
      </p>

      <H2>Destinations we cannot supply</H2>
      <p>
        We do not supply, physically or electronically, to{" "}
        {blocked.join(", ")}. An order to one of these is refused at checkout
        rather than accepted and quietly cancelled later.
      </p>
      <p>
        This applies to software licences as much as to hardware. A licence key
        is an export even though it travels by email, and it is not exempt
        because nothing physical crosses a border.
      </p>

      <H2>What you confirm when you order</H2>
      <Ul>
        <li>
          You are not, and are not acting for, a person or entity on a
          restricted-party or sanctions list.
        </li>
        <li>
          The goods are not destined for a prohibited end use — nuclear, missile,
          or chemical and biological weapons applications among them.
        </li>
        <li>
          You will not re-export or transfer the goods in breach of any
          applicable control.
        </li>
        <li>
          The delivery address you give is the real destination, not a
          forwarding point concealing one.
        </li>
      </Ul>
      <p>
        Placing an order is your confirmation of all four. If any of them is not
        true, do not order.
      </p>

      <H2>Screening</H2>
      <p>
        We screen orders against the sanctions and restricted-party lists that
        apply to us as an Indian exporter, and against those of the destination
        country. Where an order is held for screening we tell you, and where it
        is refused we refund in full. We do not charge for a refused order and we
        do not keep a deposit.
      </p>

      <H2>Declarations</H2>
      <p>
        Every parcel travels with a commercial invoice declaring the true
        description, HS code, country of origin and the price you actually paid.
      </p>
      <p>
        We will not under-declare a shipment, describe goods as samples, or mark
        an order as a gift. Customers ask; the answer is always no. It is customs
        fraud, it voids the shipment&apos;s insurance, and it is the importer —
        you — who is exposed to the penalty and the seizure. A supplier willing
        to do it for you is telling you what they will do to you later.
      </p>

      <H2>Where goods ship from</H2>
      <p>
        Physical goods are dispatched from {config.shipsFrom}. That determines
        which export regime applies to the sale, and the country of origin shown
        on each product page determines what your own customs authority assesses
        duty against — the two are frequently different and both are declared.
      </p>

      <H2>Questions</H2>
      <p>
        If you are unsure whether an item can be lawfully imported into your
        country, or whether your organisation needs an import licence for it, ask
        us before ordering. We would far rather answer a question than deal with
        a seizure.
      </p>
    </PolicyPage>
  );
}
