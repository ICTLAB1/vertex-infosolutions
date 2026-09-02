import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

/**
 * The storefront's own frame.
 *
 * Kept here rather than in the root layout so that the back office is not
 * wrapped in a shop. Search, categories and the marketing footer belong around
 * anything a customer looks at and around nothing else; an admin page rendered
 * inside them reads as a page of the store, which is exactly what somebody
 * demonstrating the site to a customer must not have happen.
 *
 * Route groups do not appear in URLs, so every path under here is unchanged.
 */
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>
      <span id="top" />
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
