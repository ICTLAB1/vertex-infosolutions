import Image from "next/image";

/**
 * The publisher authorisations this business actually holds.
 *
 * A claim about the business rather than decoration, so a badge belongs here
 * only while the certification does — and only when we hold the publisher's
 * own artwork for it. Adding one is a line in this list plus its file under
 * `public/badges/`.
 *
 * They sit on a light plate deliberately. The strip runs under a dark header
 * and the footer is darker still; these are transparent artwork with black in
 * them, and unplated they half-disappear. A partner badge that cannot be read
 * is worse than no badge.
 */
const BADGES: readonly {
  src: string;
  alt: string;
  width: number;
  height: number;
}[] = [
  {
    src: "/badges/adobe-certified-reseller.png",
    alt: "Adobe Certified Reseller",
    width: 1921,
    height: 895,
  },
];

export function PartnerBadges({
  className = "",
  width = 130,
}: {
  className?: string;
  /** Rendered width in pixels of each badge. */
  width?: number;
}) {
  if (BADGES.length === 0) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {BADGES.map((badge) => (
        <li key={badge.src} className="rounded-md bg-white px-2.5 py-1.5">
          <Image
            src={badge.src}
            alt={badge.alt}
            width={badge.width}
            height={badge.height}
            sizes={`${width}px`}
            className="h-auto"
            style={{ width }}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The slim strip under the header, on every page of the shop.
 *
 * Placed at the top because it answers the question a first-time visitor asks
 * before any other — whether this is a real supplier — and because the answer
 * stops being useful once they have scrolled past the product they came for.
 */
export function PartnerStrip() {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">
          Authorised reseller
        </p>
        <PartnerBadges width={112} />
        <p className="text-[12px] text-muted">
          Genuine licences, supplied under the publisher&apos;s own end-user
          terms.
        </p>
      </div>
    </div>
  );
}
