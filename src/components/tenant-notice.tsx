/**
 * Says that a CSP licence arrives in a new Microsoft tenant.
 *
 * This is not small print. A CSP subscription is bought in the region the
 * reseller trades in and cannot be attached to a tenant that already exists in
 * another one, so Microsoft provisions a new tenant with a new tenant ID for
 * the order. Somebody expecting these seats to appear beside their existing
 * users has bought the wrong thing, and they should find that out on the
 * product page rather than after paying — so the same words appear there, in
 * the basket and again at checkout.
 */
export function TenantNotice({ tone = "full" }: { tone?: "full" | "line" }) {
  if (tone === "line") {
    return (
      <p className="mt-1 text-[12px] text-muted">
        Delivered in a <strong className="font-semibold">new Microsoft tenant</strong> —
        it cannot be added to an existing one.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-nav-2/30 bg-nav-2/5 p-2.5 text-[12px] text-ink">
      <strong className="font-semibold">A new Microsoft tenant is created</strong>{" "}
      for this order, with its own tenant ID. Because the subscription is bought
      in a different region from yours, it cannot be added to a Microsoft tenant
      you already have. Your existing users, mailboxes and data stay where they
      are.
    </div>
  );
}
