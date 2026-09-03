import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { H2, PolicyPage, Ul } from "@/components/policy";
import { RESTRICTED_COUNTRIES } from "@/lib/market";
import { getSiteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Export compliance",
  description:
    "Where we can and cannot supply software licences, the sanctions and end-use restrictions that apply, and what you are confirming when you order from outside India.",
  path: "/export-compliance",
});

export default function ExportCompliancePage() {
  const config = getSiteConfig();
  const blocked = RESTRICTED_COUNTRIES.map((c) => c.name);

  return (
    <PolicyPage title="Export compliance" updated="2 September 2026">
      <p>
        Licensed software is a controlled good. Supplying it across a border is
        subject to export controls and trade sanctions, and breaking those is a
        criminal matter rather than a commercial one — for us as the exporter
        and, in some cases, for you as the recipient.
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
        A licence key is an export even though it travels by email. It is not
        exempt because nothing physical crosses a border, and it is not exempt
        because it was delivered in seconds.
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

      <H2>Invoicing</H2>
      <p>
        Every invoice states the true product, the real price paid and the
        actual buyer. Customers occasionally ask us to describe a licence as
        something else, split an invoice to stay under a threshold, or bill a
        different entity from the one receiving the keys. The answer is always
        no — that is invoice fraud, and it exposes the buyer far more than it
        exposes us.
      </p>

      <H2>Where the supply comes from</H2>
      <p>
        Licences are supplied from {config.shipsFrom}, which determines the
        export regime that applies to the sale. An electronic delivery is still
        an export: nothing crosses a border physically, and the controls apply
        exactly the same.
      </p>

      <H2>Questions</H2>
      <p>
        If you are unsure whether your organisation can lawfully receive a
        particular product, or whether an end use falls inside a control, ask us
        before ordering. We would far rather answer a question than unwind an
        order.
      </p>
    </PolicyPage>
  );
}
