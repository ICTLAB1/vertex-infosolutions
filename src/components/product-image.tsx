import Image from "next/image";

import { Glyph } from "@/components/glyph";

/**
 * The picture on a product tile.
 *
 * The publisher's own icon where we hold a licensed copy of it, and the drawn
 * placeholder everywhere else. Both are boxed to the same square so a grid of
 * products keeps its baseline whether or not artwork exists — a shelf where
 * some tiles are logos and others are line art should still line up.
 *
 * `sizes` is set because these are laid out by CSS rather than at a fixed
 * pixel width, and without it the browser is asked to fetch the largest
 * candidate for a 128px tile.
 */
export function ProductImage({
  logo,
  glyph,
  name,
  className,
  sizes,
  eager = false,
}: {
  logo: string | null;
  glyph: string;
  name: string;
  /** Tailwind size classes for the square, e.g. "h-20 w-20". */
  className: string;
  sizes: string;
  /**
   * True for the handful of tiles above the fold.
   *
   * Largest Contentful Paint is measured on whatever the largest visible
   * element turns out to be, and on a shelf that is one of the first product
   * pictures. Lazy-loading it means the browser only starts fetching it after
   * layout — which is to say, a page that is slow by construction. Everything
   * further down the grid stays lazy, which is the whole point of only
   * promoting a few.
   */
  eager?: boolean;
}) {
  if (!logo) return <Glyph name={glyph} className={className} />;

  return (
    <span className={`relative block ${className}`}>
      <Image
        src={logo}
        alt={`${name} logo`}
        fill
        sizes={sizes}
        className="object-contain"
        priority={eager}
        fetchPriority={eager ? "high" : "auto"}
      />
    </span>
  );
}
