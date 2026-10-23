/**
 * How the Microsoft plans compare.
 *
 * Taken from Microsoft's own "Modern Work Plan Comparison" charts, which are
 * what a buyer is shown on microsoft.com. Each tick was matched to its column
 * by position on the page rather than by reading order, because a row with two
 * ticks is otherwise ambiguous — it could be Basic and Standard, or Standard
 * and Premium.
 *
 * Rows are the ones that decide a purchase. The full charts run to two hundred
 * lines each and nobody reads them on a product page.
 *
 * Two rows from the enterprise chart are deliberately absent: Power BI Pro and
 * online meetings both extracted with a tick sitting outside its column, and a
 * wrong tick here is a wrong promise about what somebody is buying. Add them
 * back by hand once checked against the chart.
 */

export type PlanState = true | "add-on";

export type ComparisonChart = {
  /** Shown above the table. */
  title: string;
  plans: { key: string; label: string; slug: string }[];
  sections: { section: string; rows: { feature: string; plans: Record<string, PlanState> }[] }[];
};

const businessChart: ComparisonChart = {
  title: "How the Microsoft 365 Business plans compare",
  plans: [
    { key: "Basic", label: "Business Basic", slug: "microsoft-365-business-basic" },
    { key: "Standard", label: "Business Standard", slug: "microsoft-365-business-standard" },
    { key: "Premium", label: "Business Premium", slug: "microsoft-365-business-premium" },
  ],
  sections: [
  {
    section: "Apps and devices",
    rows: [
      { feature: "Microsoft 365 for the web", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "Desktop client apps", plans: { Standard: true, Premium: true } },
      { feature: "Install apps on up to 5 PCs/Mac + 5 tablets + 5 smartphones", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "Microsoft 365 for mobile", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "Outlook desktop client", plans: { Standard: true, Premium: true } },
      { feature: "Multilingual user interface for Microsoft 365 apps", plans: { Standard: true, Premium: true } },
    ],
  },
  {
    section: "Email and meetings",
    rows: [
      { feature: "Exchange Online Plan 1, 50 GB mailbox", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "Auto-expanding email archive", plans: { Premium: true } },
      { feature: "Microsoft Teams", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "Webinars", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "Audio Conferencing", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "Microsoft Bookings", plans: { Basic: true, Standard: true, Premium: true } },
    ],
  },
  {
    section: "Storage and collaboration",
    rows: [
      { feature: "SharePoint Plan 1", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "OneDrive personal storage", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "Create and share Loop workspaces", plans: { Standard: true, Premium: true } },
      { feature: "Clipchamp Standard", plans: { Standard: true, Premium: true } },
    ],
  },
  {
    section: "AI",
    rows: [
      { feature: "Copilot Chat", plans: { Basic: true, Standard: true, Premium: true } },
      { feature: "Microsoft Copilot", plans: { Basic: "add-on", Standard: "add-on", Premium: "add-on" } },
    ],
  },
  {
    section: "Security and device management",
    rows: [
      { feature: "Conditional Access", plans: { Premium: true } },
      { feature: "Windows Autopilot", plans: { Premium: true } },
      { feature: "Azure Information Protection Plan 1", plans: { Premium: true } },
      { feature: "Microsoft Defender for Office 365 Plan 1", plans: { Premium: true } },
    ],
  },
  ],
};

const enterpriseChart: ComparisonChart = {
  title: "How the enterprise plans compare",
  plans: [
    { key: "o365e1", label: "Office 365 E1", slug: "office-365-e1" },
    { key: "o365e3", label: "Office 365 E3", slug: "office-365-e3" },
    {
      key: "o365e5",
      label: "Office 365 E5",
      slug: "office-365-e5-without-audio-conferencing",
    },
    { key: "m365e3", label: "Microsoft 365 E3", slug: "microsoft-365-e3" },
    {
      key: "m365e5",
      label: "Microsoft 365 E5",
      slug: "microsoft-365-e5-without-audio-conferencing",
    },
  ],
  sections: [
  {
    section: "Apps and devices",
    rows: [
      { feature: "Microsoft 365 for the web", plans: { o365e1: true, o365e3: true, o365e5: true, m365e3: true, m365e5: true } },
      { feature: "Desktop client apps", plans: { o365e3: true, o365e5: true, m365e3: true, m365e5: true } },
      { feature: "Outlook desktop client", plans: { o365e3: true, o365e5: true, m365e3: true, m365e5: true } },
    ],
  },
  {
    section: "Email and meetings",
    rows: [
      { feature: "Microsoft Teams", plans: { o365e1: true, o365e3: true, o365e5: true, m365e3: true, m365e5: true } },
      { feature: "Webinars", plans: { o365e1: true, o365e3: true, o365e5: true, m365e3: true, m365e5: true } },
      { feature: "Audio Conferencing", plans: { o365e1: "add-on", o365e3: "add-on", o365e5: "add-on", m365e3: "add-on", m365e5: "add-on" } },
    ],
  },
  {
    section: "Analytics",
    rows: [

    ],
  },
  {
    section: "AI",
    rows: [
      { feature: "Copilot Chat", plans: { o365e1: true, o365e3: true, o365e5: true, m365e3: true, m365e5: true } },
      { feature: "Microsoft Copilot", plans: { o365e1: "add-on", o365e3: "add-on", o365e5: "add-on", m365e3: "add-on", m365e5: "add-on" } },
    ],
  },
  ],
};

/**
 * Which chart a product page shows, and which column is the page's own.
 *
 * A product not listed here shows no table, which is most of the four hundred:
 * a comparison is only useful where the buyer is actually choosing between
 * named tiers.
 */
const BY_SLUG: Record<string, { chart: ComparisonChart; highlight: string }> = {
  "microsoft-365-business-basic": { chart: businessChart, highlight: "Basic" },
  "microsoft-365-business-standard": { chart: businessChart, highlight: "Standard" },
  "microsoft-365-business-premium": { chart: businessChart, highlight: "Premium" },
  "office-365-e1": { chart: enterpriseChart, highlight: "o365e1" },
  "office-365-e3": { chart: enterpriseChart, highlight: "o365e3" },
  "office-365-e5-without-audio-conferencing": {
    chart: enterpriseChart,
    highlight: "o365e5",
  },
  "microsoft-365-e3": { chart: enterpriseChart, highlight: "m365e3" },
  "microsoft-365-e5-without-audio-conferencing": {
    chart: enterpriseChart,
    highlight: "m365e5",
  },
};

export function comparisonFor(slug: string) {
  return BY_SLUG[slug] ?? null;
}
