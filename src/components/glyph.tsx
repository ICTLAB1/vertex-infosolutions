/**
 * Product illustrations.
 *
 * The catalogue ships without photography, and a broken image icon or a grey
 * rectangle both read as a site that isn't finished. These line drawings are
 * deliberately schematic — clearly a stand-in rather than a bad photo — and are
 * swapped for real product shots by giving `Product.glyph` an image path
 * instead. One per category keeps a grid legible at a glance.
 */

type GlyphProps = { name: string; className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Laptop() {
  return (
    <g {...STROKE}>
      <rect x="14" y="16" width="52" height="34" rx="3" />
      <rect x="21" y="23" width="38" height="20" rx="1.5" />
      <path d="M6 56h68l-4 6H10z" />
      <path d="M34 59h12" />
    </g>
  );
}

function Monitor() {
  return (
    <g {...STROKE}>
      <rect x="8" y="14" width="64" height="40" rx="3" />
      <rect x="14" y="20" width="52" height="28" rx="1.5" />
      <path d="M32 54v8h16v-8" />
      <path d="M24 62h32" />
    </g>
  );
}

function Printer() {
  return (
    <g {...STROKE}>
      <path d="M22 26V12h36v14" />
      <rect x="10" y="26" width="60" height="24" rx="3" />
      <rect x="22" y="44" width="36" height="20" rx="2" />
      <path d="M28 51h24M28 57h16" />
      <circle cx="61" cy="34" r="2" />
    </g>
  );
}

function Router() {
  return (
    <g {...STROKE}>
      <rect x="12" y="40" width="56" height="20" rx="4" />
      <path d="M24 50h6M36 50h6M48 50h6" />
      <path d="M40 40V30" />
      <path d="M28 24a17 17 0 0 1 24 0" />
      <path d="M33 31a10 10 0 0 1 14 0" />
    </g>
  );
}

function Ssd() {
  return (
    <g {...STROKE}>
      <rect x="12" y="24" width="56" height="32" rx="3" />
      <path d="M12 44h56" />
      <circle cx="22" cy="34" r="2.5" />
      <path d="M32 34h26" />
      <path d="M22 50h36" />
    </g>
  );
}

function Licence() {
  return (
    <g {...STROKE}>
      <rect x="14" y="16" width="52" height="40" rx="3" />
      <path d="M14 27h52" />
      <circle cx="30" cy="40" r="6" />
      <path d="M36 40h18M50 40v5" />
      <path d="M20 21.5h3M27 21.5h3" />
      <path d="M30 60h20" />
    </g>
  );
}

function Keyboard() {
  return (
    <g {...STROKE}>
      <rect x="6" y="26" width="52" height="30" rx="3" />
      <path d="M14 34h4M24 34h4M34 34h4M44 34h4" />
      <path d="M14 42h4M24 42h4M34 42h4M44 42h4" />
      <path d="M22 50h20" />
      <path d="M66 34c4 0 6 3 6 8s-2 12-6 12-6-7-6-12 2-8 6-8z" />
    </g>
  );
}

function Ups() {
  return (
    <g {...STROKE}>
      <rect x="22" y="12" width="36" height="56" rx="4" />
      <path d="M22 26h36" />
      <path d="M42 34l-8 12h12l-8 12" />
      <circle cx="31" cy="19" r="2" />
      <path d="M38 19h12" />
    </g>
  );
}

function Box() {
  return (
    <g {...STROKE}>
      <path d="M40 12l28 14v28L40 68 12 54V26z" />
      <path d="M12 26l28 14 28-14M40 40v28" />
    </g>
  );
}

const GLYPHS: Record<string, () => React.JSX.Element> = {
  laptop: Laptop,
  monitor: Monitor,
  printer: Printer,
  router: Router,
  ssd: Ssd,
  licence: Licence,
  keyboard: Keyboard,
  ups: Ups,
  box: Box,
};

export function Glyph({ name, className }: GlyphProps) {
  const Drawing = GLYPHS[name] ?? Box;
  return (
    <svg
      viewBox="0 0 80 80"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <Drawing />
    </svg>
  );
}
