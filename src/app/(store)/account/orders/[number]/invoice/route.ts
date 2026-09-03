import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { invoiceById, invoiceFilename, renderInvoice } from "@/lib/invoice";

/**
 * The invoice, as a file.
 *
 * Scoped to its owner the same way the order page is: the query filters on
 * `userId` as well as the order number, so guessing a six-digit number returns
 * a 404 rather than somebody else's name, address and GSTIN. That matters more
 * here than on the page — a PDF is a document people forward.
 *
 * Rendered on demand rather than stored. The order is the record; the PDF is a
 * view of it, and one that is generated fresh cannot drift from the row it
 * describes.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/account/orders/[number]/invoice">,
) {
  const { number } = await context.params;

  const user = await getUser();
  // A file download has nowhere useful to redirect to, so this answers with a
  // status rather than a sign-in page the browser would save as a .pdf.
  if (!user) {
    return new Response("Sign in to download this invoice.", { status: 401 });
  }

  // Ownership first, and on its own: the number alone is six digits, and this
  // filter is the whole of what stops one customer reading another's invoice.
  const order = await prisma.order.findFirst({
    where: { number, userId: user.id },
    select: { id: true },
  });
  if (!order) return new Response("Not found", { status: 404 });

  // The same builder the confirmation email attaches, so the document a
  // customer downloads and the one they were sent cannot drift apart.
  const invoice = await invoiceById(order.id);
  if (!invoice) return new Response("Not found", { status: 404 });
  const pdf = renderInvoice(invoice);

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` so it opens in the browser's viewer; the filename is still
      // what a save produces.
      "Content-Disposition": `inline; filename="${invoiceFilename(invoice)}"`,
      "Content-Length": String(pdf.byteLength),
      // Somebody else's invoice must never come out of a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
