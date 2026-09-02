import type { Metadata } from "next";

import { H2, PolicyPage, Ul } from "@/components/policy";
import { getSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Grievance redressal",
  description:
    "How to raise a complaint with Vertex Infosolutions, and who is responsible for answering it.",
};

export default function GrievancePage() {
  const config = getSiteConfig();

  return (
    <PolicyPage title="Grievance redressal" updated="2 September 2026">
      <p>
        If something has gone wrong and the usual support route has not fixed it,
        this is the escalation. Under the Consumer Protection (E-Commerce) Rules,
        2020 we are required to name an officer responsible for complaints, to
        acknowledge a complaint within 48 hours, and to resolve it within one
        month. Those are the rules we work to.
      </p>

      <H2>Grievance officer</H2>
      {config.grievanceName ? (
        <div className="rounded-md border border-line bg-ground/50 p-4 text-ink">
          <p className="font-semibold">{config.grievanceName}</p>
          {config.grievanceEmail ? (
            <p>
              <a
                href={`mailto:${config.grievanceEmail}`}
                className="text-link underline"
              >
                {config.grievanceEmail}
              </a>
            </p>
          ) : null}
          {config.grievancePhone ? <p>{config.grievancePhone}</p> : null}
          {config.address ? <p className="mt-2 text-muted">{config.address}</p> : null}
        </div>
      ) : (
        <p className="rounded-md border border-warn/40 bg-warn/5 p-4 text-warn">
          A grievance officer has not been configured for this deployment. This
          has to be filled in before the store takes a real order.
        </p>
      )}

      <H2>Before you escalate</H2>
      <p>
        Most problems are faster to solve through normal support, because the
        person answering can see your order. Try that first — the escalation
        below does not get you a quicker answer, it gets you a more senior one.
      </p>

      <H2>What to include</H2>
      <Ul>
        <li>Your order number.</li>
        <li>The email address the order was placed with.</li>
        <li>What went wrong, and what you would like done about it.</li>
        <li>Anything you have already been told, and by whom.</li>
      </Ul>

      <H2>What happens then</H2>
      <Ul>
        <li>
          You get an acknowledgement with a reference number within 48 hours.
        </li>
        <li>
          The officer investigates and responds with a decision and a reason.
        </li>
        <li>Resolution within one month of the complaint being received.</li>
      </Ul>

      <H2>If you are still not satisfied</H2>
      <p>
        You can take the matter to the National Consumer Helpline on 1915, or to
        the consumer commission with jurisdiction over your address. Escalating
        to us first is not a precondition, but it is usually faster.
      </p>
    </PolicyPage>
  );
}
