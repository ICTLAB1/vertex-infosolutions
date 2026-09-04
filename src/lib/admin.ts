import "server-only";

import { notFound, redirect } from "next/navigation";

import { getUser, normaliseEmail, type SignedInUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSiteConfig } from "@/lib/site";

/**
 * Who may run the store.
 *
 * Administrators are named in `ADMIN_EMAILS` rather than flagged in the
 * database. That is deliberate for a business this size: promoting somebody is
 * a configuration change on the App Service, made by whoever holds the Azure
 * subscription, and it cannot be done by anything that reaches the database —
 * which includes every bug in this application. The cost is that the list
 * changes on a restart rather than in a form, which for a handful of people is
 * the right trade.
 *
 * The address is matched after normalisation, so a stray capital or a trailing
 * space in the configuration does not silently lock somebody out.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((entry) => normaliseEmail(entry))
    .filter((entry) => entry.includes("@"));
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const wanted = normaliseEmail(email);
  // An empty list means nobody, never everybody. A store whose configuration
  // failed to load must not hand the admin area to the next visitor.
  return adminEmails().some((entry) => entry === wanted);
}

/**
 * Where a message meant for the shop itself goes.
 *
 * The support address first, because that is the mailbox somebody is paid to
 * watch and the one printed on the site; then everybody who can run the back
 * office, because an order that arrives at midnight should reach a person and
 * not only an inbox. Deduplicated, since the two lists usually overlap.
 *
 * Empty is possible and is not an error — a shop with no support address
 * configured still takes orders, and they are all in the back office. It means
 * nothing is pushed anywhere, which is worth knowing rather than crashing on.
 */
export async function shopInboxes(): Promise<string[]> {
  const support = (await getSiteConfig()).supportEmail;
  return [
    ...new Set(
      [support ? normaliseEmail(support) : null, ...adminEmails()].filter(
        (address): address is string => Boolean(address),
      ),
    ),
  ];
}

export type Admin = SignedInUser;

/**
 * Guard every admin page and every admin action with this.
 *
 * A signed-out visitor is sent to sign in, because they may well be the
 * administrator on a new laptop. Somebody signed in who is not on the list gets
 * a 404: they have proved who they are and the answer is no, and a 403 would
 * only confirm there is something here to find.
 *
 * It is called in each page and each action rather than once in the layout.
 * A layout does not run before a server action, so a guard that lived only
 * there would protect the pages and none of the writes.
 */
export async function requireAdmin(next = "/admin"): Promise<Admin> {
  const user = await getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  if (!isAdmin(user.email)) notFound();
  return user;
}

/**
 * Write down what an administrator did.
 *
 * Called after the change, never instead of it: an audit row that exists for a
 * change that failed is worse than no row at all.
 */
export async function recordAdminAction(
  actor: Admin,
  action: string,
  subject: string,
  detail: string,
): Promise<void> {
  await prisma.adminAction.create({
    data: { actorEmail: actor.email, action, subject, detail },
  });
}
