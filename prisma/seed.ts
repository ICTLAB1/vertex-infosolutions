/**
 * Sample catalogue — Microsoft, Adobe and Autodesk licences.
 *
 * Prices are illustrative but shaped like real ones: the INR figure is not the
 * USD figure converted. Publishers price India separately and considerably
 * lower, and pretending otherwise would produce a catalogue that looks
 * plausible and prices nothing correctly.
 *
 * INR prices are GST-inclusive, because that is what an Indian buyer expects to
 * see and what the law requires be displayed. USD prices carry no Indian tax at
 * all — those sales are exports.
 *
 * Replace all of it with the real price book before launch.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Term = "ANNUAL_SUBSCRIPTION" | "MONTHLY_COMMITMENT" | "PERPETUAL";

type SeedVariant = {
  sku: string;
  name: string;
  seats: number;
  /** [list, price] in whole dollars. */
  usd: [number, number];
  /** [list, price] in whole rupees, GST-inclusive. */
  inr: [number, number];
};

type SeedProduct = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  term: Term;
  summary: string;
  bullets: string[];
  specs: Record<string, string>;
  featured?: boolean;
  variants: SeedVariant[];
  reviews?: {
    author: string;
    country?: string;
    rating: number;
    title: string;
    body: string;
    verified?: boolean;
  }[];
};

const CATEGORIES = [
  {
    slug: "productivity",
    name: "Productivity & collaboration",
    blurb: "Email, documents and meetings for a whole team.",
    position: 1,
  },
  {
    slug: "creative",
    name: "Creative & design",
    blurb: "Design, photography, video and 3D.",
    position: 2,
  },
  {
    slug: "cad",
    name: "Engineering & CAD",
    blurb: "Drafting, modelling and simulation.",
    position: 3,
  },
  {
    slug: "servers",
    name: "Operating systems & servers",
    blurb: "Desktop and server operating systems.",
    position: 4,
  },
  {
    slug: "analytics",
    name: "Analytics & planning",
    blurb: "Reporting, diagramming and project management.",
    position: 5,
  },
];

const BRANDS = [
  {
    name: "Microsoft",
    slug: "microsoft",
    blurb: "Microsoft 365, Windows, Windows Server and the Power Platform.",
  },
  {
    name: "Adobe",
    slug: "adobe",
    blurb: "Creative Cloud, Acrobat and Substance 3D, licensed for teams.",
  },
  {
    name: "Autodesk",
    slug: "autodesk",
    blurb: "AutoCAD, Revit, Fusion and the media and entertainment range.",
  },
];

const PRODUCTS: SeedProduct[] = [
  // ---------------------------------------------------------------- Microsoft
  {
    slug: "microsoft-365-business-standard",
    name: "Microsoft 365 Business Standard",
    brand: "Microsoft",
    category: "productivity",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Desktop Office apps, business email on your own domain, and 1 TB of OneDrive per user.",
    bullets: [
      "Word, Excel, PowerPoint and Outlook installed on up to 5 devices per user",
      "Business email on your own domain with a 50 GB mailbox",
      "1 TB of OneDrive storage per user",
      "Teams, SharePoint and Microsoft Bookings",
      "Licence keys issued to your email the moment payment clears",
    ],
    specs: {
      "Licence type": "Annual subscription, per user",
      "Minimum term": "12 months",
      Delivery: "Electronic — issued on payment",
      Platform: "Windows, macOS, iOS, Android, web",
      Support: "Microsoft standard support",
    },
    featured: true,
    variants: [
      { sku: "MS-365-BS-1U", name: "1 user, 1 year", seats: 1, usd: [165, 150], inr: [10100, 9200] },
      { sku: "MS-365-BS-5U", name: "5 users, 1 year", seats: 5, usd: [825, 720], inr: [50500, 44000] },
      { sku: "MS-365-BS-10U", name: "10 users, 1 year", seats: 10, usd: [1650, 1400], inr: [101000, 86000] },
    ],
    reviews: [
      { author: "Deepa L.", country: "United States", rating: 5, title: "Keys arrived in under a minute", body: "Ordered ten seats at 9pm and the keys were in my inbox before I closed the laptop. Redemption was straightforward.", verified: true },
      { author: "Ashok G.", country: "India", rating: 4, title: "Cheaper than going direct, GST invoice was clean", body: "About 12% under list, and the GST invoice had our GSTIN on it so accounts could claim the input credit. That mattered more than the discount.", verified: true },
    ],
  },
  {
    slug: "microsoft-365-business-premium",
    name: "Microsoft 365 Business Premium",
    brand: "Microsoft",
    category: "productivity",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Everything in Business Standard plus device management and advanced threat protection.",
    bullets: [
      "All of Business Standard, per user",
      "Intune device management for company and personal devices",
      "Microsoft Defender for Office 365 and Entra ID Plan 1",
      "Conditional access and data loss prevention",
    ],
    specs: {
      "Licence type": "Annual subscription, per user",
      "Minimum term": "12 months",
      Delivery: "Electronic — issued on payment",
      "Seat cap": "300 users",
    },
    featured: true,
    variants: [
      { sku: "MS-365-BP-1U", name: "1 user, 1 year", seats: 1, usd: [288, 264], inr: [17700, 16400] },
      { sku: "MS-365-BP-5U", name: "5 users, 1 year", seats: 5, usd: [1440, 1290], inr: [88500, 79500] },
    ],
    reviews: [
      { author: "Priya N.", country: "India", rating: 5, title: "Intune alone justifies the step up", body: "We moved from Standard after a lost laptop. Being able to wipe it remotely was worth the difference on its own.", verified: true },
    ],
  },
  {
    slug: "microsoft-365-business-basic",
    name: "Microsoft 365 Business Basic",
    brand: "Microsoft",
    category: "productivity",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Business email, Teams and the web versions of the Office apps. No desktop installs.",
    bullets: [
      "Business email on your own domain, 50 GB mailbox",
      "Web and mobile versions of Word, Excel, PowerPoint and Outlook",
      "Teams, SharePoint and 1 TB of OneDrive per user",
      "No desktop applications — see Business Standard for those",
    ],
    specs: {
      "Licence type": "Annual subscription, per user",
      Delivery: "Electronic — issued on payment",
      Platform: "Web and mobile only",
    },
    variants: [
      { sku: "MS-365-BB-1U", name: "1 user, 1 year", seats: 1, usd: [78, 72], inr: [4700, 4300] },
      { sku: "MS-365-BB-10U", name: "10 users, 1 year", seats: 10, usd: [780, 660], inr: [47000, 40500] },
    ],
  },
  {
    slug: "windows-11-pro",
    name: "Windows 11 Pro",
    brand: "Microsoft",
    category: "servers",
    term: "PERPETUAL",
    summary:
      "The business edition of Windows, bought outright — BitLocker, domain join and Hyper-V.",
    bullets: [
      "BitLocker device encryption",
      "Domain and Entra ID join, with Group Policy",
      "Hyper-V and Windows Sandbox",
      "Remote Desktop host",
      "Perpetual — no renewal, tied to the device",
    ],
    specs: {
      "Licence type": "Perpetual, single device",
      Delivery: "Electronic — product key issued on payment",
      Platform: "Windows",
      Transferable: "No — tied to the device it activates",
    },
    variants: [
      { sku: "MS-WIN11-PRO", name: "1 device, perpetual", seats: 1, usd: [219, 199], inr: [18000, 16500] },
    ],
    reviews: [
      { author: "Karthik S.", country: "India", rating: 5, title: "Genuine key, activated first time", body: "Bought four for new builds. All activated online without a phone call, which is more than I can say for the marketplace sellers.", verified: true },
    ],
  },
  {
    slug: "windows-server-2022-standard",
    name: "Windows Server 2022 Standard",
    brand: "Microsoft",
    category: "servers",
    term: "PERPETUAL",
    summary:
      "16-core server licence with two virtual machine rights. CALs sold separately.",
    bullets: [
      "Covers 16 physical cores, expandable in 2-core packs",
      "Two virtual machine licences included",
      "Storage Replica, Storage Spaces Direct and shielded VMs",
      "Client Access Licences are not included and are required",
    ],
    specs: {
      "Licence type": "Perpetual, 16 cores",
      Delivery: "Electronic — issued on payment",
      "Also required": "One CAL per user or device accessing the server",
    },
    variants: [
      { sku: "MS-WS2022-STD-16C", name: "16 cores, perpetual", seats: 1, usd: [1180, 1069], inr: [98000, 89000] },
    ],
  },
  {
    slug: "microsoft-power-bi-pro",
    name: "Microsoft Power BI Pro",
    brand: "Microsoft",
    category: "analytics",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Publish, share and collaborate on reports and dashboards, per user, per year.",
    bullets: [
      "Publish reports to shared workspaces",
      "Collaborate on dashboards and paginated reports",
      "Refresh datasets up to eight times a day",
      "Row-level security",
    ],
    specs: {
      "Licence type": "Annual subscription, per user",
      Delivery: "Electronic — issued on payment",
      Platform: "Windows, web, mobile",
    },
    variants: [
      { sku: "MS-PBI-PRO-1U", name: "1 user, 1 year", seats: 1, usd: [180, 168], inr: [11400, 10500] },
      { sku: "MS-PBI-PRO-5U", name: "5 users, 1 year", seats: 5, usd: [900, 810], inr: [57000, 51000] },
    ],
  },
  {
    slug: "microsoft-project-plan-3",
    name: "Microsoft Project Plan 3",
    brand: "Microsoft",
    category: "analytics",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Desktop and web project management with resource levelling and roadmaps.",
    bullets: [
      "Project desktop client plus the web app",
      "Resource management and levelling",
      "Roadmaps across multiple projects",
      "Submit and track timesheets",
    ],
    specs: {
      "Licence type": "Annual subscription, per user",
      Delivery: "Electronic — issued on payment",
      Platform: "Windows desktop and web",
    },
    variants: [
      { sku: "MS-PROJ-P3-1U", name: "1 user, 1 year", seats: 1, usd: [396, 360], inr: [24500, 22500] },
    ],
  },
  {
    slug: "microsoft-visio-plan-2",
    name: "Microsoft Visio Plan 2",
    brand: "Microsoft",
    category: "analytics",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Diagramming with the Visio desktop app, data-linked shapes and web publishing.",
    bullets: [
      "Visio desktop app installed on up to 5 devices",
      "Data-linked diagrams from Excel and Power BI",
      "Publish and share diagrams on the web",
      "2 GB of Visio-specific storage",
    ],
    specs: {
      "Licence type": "Annual subscription, per user",
      Delivery: "Electronic — issued on payment",
      Platform: "Windows desktop and web",
    },
    variants: [
      { sku: "MS-VISIO-P2-1U", name: "1 user, 1 year", seats: 1, usd: [198, 180], inr: [12300, 11300] },
    ],
  },

  // -------------------------------------------------------------------- Adobe
  {
    slug: "adobe-creative-cloud-all-apps-teams",
    name: "Adobe Creative Cloud for Teams — All Apps",
    brand: "Adobe",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Every Creative Cloud application, licensed per seat with an admin console.",
    bullets: [
      "All 20+ Creative Cloud desktop and mobile applications",
      "1 TB of cloud storage per seat",
      "Admin console for reassigning seats as staff change",
      "Adobe Expert Services and 24/7 technical support",
      "Adobe Stock available as an add-on",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      "Minimum term": "12 months",
      Delivery: "Electronic — seat assigned on payment",
      Platform: "Windows, macOS",
      Reassignable: "Yes, through the admin console",
    },
    featured: true,
    variants: [
      { sku: "ADB-CCT-ALL-1S", name: "1 seat, 1 year", seats: 1, usd: [900, 840], inr: [66000, 63000] },
      { sku: "ADB-CCT-ALL-5S", name: "5 seats, 1 year", seats: 5, usd: [4500, 4020], inr: [330000, 299000] },
      { sku: "ADB-CCT-ALL-10S", name: "10 seats, 1 year", seats: 10, usd: [9000, 7900], inr: [660000, 585000] },
    ],
    reviews: [
      { author: "Studio Lead", country: "Germany", rating: 4, title: "Seat reassignment is the win", body: "Being able to move a seat when someone leaves has saved us buying spares. Invoicing was clean for our accounts team.", verified: true },
      { author: "Ritu M.", country: "India", rating: 5, title: "Renewal reminder came a month early", body: "No auto-renew surprise, which is the opposite of our last supplier. Priced in rupees with GST, so nothing to reconcile.", verified: true },
    ],
  },
  {
    slug: "adobe-creative-cloud-single-app-teams",
    name: "Adobe Creative Cloud for Teams — Single App",
    brand: "Adobe",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "One Creative Cloud application of your choice, per seat, with the team admin console.",
    bullets: [
      "Choose any one app — Photoshop, Illustrator, Premiere Pro, InDesign, After Effects",
      "100 GB of cloud storage per seat",
      "Admin console for reassigning seats",
      "Tell us which application after checkout",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      Delivery: "Electronic — seat assigned on payment",
      Platform: "Windows, macOS",
      Note: "The application is chosen at assignment, not at purchase",
    },
    variants: [
      { sku: "ADB-CCT-SINGLE-1S", name: "1 seat, 1 year", seats: 1, usd: [440, 408], inr: [30500, 28800] },
      { sku: "ADB-CCT-SINGLE-5S", name: "5 seats, 1 year", seats: 5, usd: [2200, 1950], inr: [152500, 137000] },
    ],
  },
  {
    slug: "adobe-acrobat-pro-teams",
    name: "Adobe Acrobat Pro for Teams",
    brand: "Adobe",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Create, edit, sign and protect PDFs, with e-signature and the admin console.",
    bullets: [
      "Edit text and images directly in a PDF",
      "Collect legally binding e-signatures",
      "Redact and password-protect documents",
      "Compare two versions of a document",
      "Works on desktop, web and mobile",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      Delivery: "Electronic — seat assigned on payment",
      Platform: "Windows, macOS, web, iOS, Android",
    },
    featured: true,
    variants: [
      { sku: "ADB-ACRO-PRO-1S", name: "1 seat, 1 year", seats: 1, usd: [239, 215], inr: [18500, 17000] },
      { sku: "ADB-ACRO-PRO-5S", name: "5 seats, 1 year", seats: 5, usd: [1195, 1040], inr: [92500, 82000] },
    ],
    reviews: [
      { author: "Farah A.", country: "United Arab Emirates", rating: 4, title: "E-signature replaced a courier", body: "We were posting contracts. Now they come back the same afternoon. The licence covers what we needed without going to All Apps.", verified: true },
    ],
  },
  {
    slug: "adobe-substance-3d-collection",
    name: "Adobe Substance 3D Collection",
    brand: "Adobe",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "The full Substance 3D toolset — Painter, Designer, Sampler, Stager and Modeler.",
    bullets: [
      "Substance 3D Painter, Designer, Sampler, Stager and Modeler",
      "50 assets a month from the Substance 3D Assets library",
      "100 GB of cloud storage",
      "Commercial use included",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      Delivery: "Electronic — seat assigned on payment",
      Platform: "Windows, macOS",
    },
    variants: [
      { sku: "ADB-SUB3D-1S", name: "1 seat, 1 year", seats: 1, usd: [1548, 1428], inr: [112000, 104000] },
    ],
  },

  // ----------------------------------------------------------------- Autodesk
  {
    slug: "autodesk-autocad",
    name: "Autodesk AutoCAD",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Full AutoCAD with the seven industry toolsets, licensed to one named user.",
    bullets: [
      "AutoCAD on Windows and macOS, plus web and mobile",
      "Seven industry toolsets — Architecture, Mechanical, Electrical, MEP, Map 3D, Plant 3D, Raster Design",
      "Named-user licensing, reassignable through the Autodesk account",
      "Autodesk technical support included",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows, macOS, web, mobile",
      Reassignable: "Yes, through the Autodesk account portal",
    },
    featured: true,
    variants: [
      { sku: "ADSK-ACAD-1Y", name: "1 user, 1 year", seats: 1, usd: [2230, 2030], inr: [166000, 152000] },
      { sku: "ADSK-ACAD-3Y", name: "1 user, 3 years", seats: 1, usd: [6350, 5480], inr: [472000, 410000] },
    ],
    reviews: [
      { author: "Sandeep R.", country: "India", rating: 5, title: "Assigned to our account within minutes", body: "Bought two seats. Both appeared in our Autodesk account portal the same evening and we assigned them ourselves.", verified: true },
      { author: "Marcus H.", country: "Australia", rating: 4, title: "Three-year term saved real money", body: "The multi-year price is meaningfully better if you know you are keeping it. Worth asking about before you buy annual.", verified: true },
    ],
  },
  {
    slug: "autodesk-autocad-lt",
    name: "Autodesk AutoCAD LT",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "2D drafting and documentation. No 3D modelling and no industry toolsets.",
    bullets: [
      "Full 2D drafting, drawing and annotation",
      "Reads and writes the same DWG files as full AutoCAD",
      "Web and mobile apps included",
      "No 3D modelling, no toolsets, no API customisation",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows, macOS, web, mobile",
    },
    variants: [
      { sku: "ADSK-ACADLT-1Y", name: "1 user, 1 year", seats: 1, usd: [550, 500], inr: [41000, 38000] },
    ],
  },
  {
    slug: "autodesk-revit",
    name: "Autodesk Revit",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Building information modelling for architecture, structure and MEP.",
    bullets: [
      "Multidisciplinary BIM authoring in one model",
      "Structural analysis and MEP systems design",
      "Worksharing across a project team",
      "Generates schedules and documentation from the model",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows",
    },
    featured: true,
    variants: [
      { sku: "ADSK-REVIT-1Y", name: "1 user, 1 year", seats: 1, usd: [3470, 3150], inr: [258000, 236000] },
    ],
  },
  {
    slug: "autodesk-fusion",
    name: "Autodesk Fusion",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Cloud CAD, CAM, CAE and PCB in one product, licensed per named user.",
    bullets: [
      "Parametric modelling, assemblies and rendering",
      "2.5- to 5-axis CAM toolpaths",
      "Simulation and generative design (token-based)",
      "Integrated PCB design",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows, macOS",
    },
    variants: [
      { sku: "ADSK-FUSION-1Y", name: "1 user, 1 year", seats: 1, usd: [840, 760], inr: [62000, 57000] },
      { sku: "ADSK-FUSION-3Y", name: "1 user, 3 years", seats: 1, usd: [2390, 2050], inr: [176000, 154000] },
    ],
  },
  {
    slug: "autodesk-maya",
    name: "Autodesk Maya",
    brand: "Autodesk",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "3D animation, modelling, simulation and rendering for film, television and games.",
    bullets: [
      "Character rigging and animation",
      "Bifrost for procedural effects",
      "Arnold renderer with 5 licences included",
      "USD workflow support",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows, macOS, Linux",
    },
    variants: [
      { sku: "ADSK-MAYA-1Y", name: "1 user, 1 year", seats: 1, usd: [2400, 2190], inr: [179000, 164000] },
    ],
  },
  {
    slug: "autodesk-inventor",
    name: "Autodesk Inventor",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Mechanical design and product simulation for manufactured parts and assemblies.",
    bullets: [
      "Parametric, direct and freeform modelling",
      "Assembly design and large-assembly performance",
      "Stress and frame analysis built in",
      "Automated drawing generation",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows",
    },
    variants: [
      { sku: "ADSK-INV-1Y", name: "1 user, 1 year", seats: 1, usd: [3295, 2995], inr: [245000, 225000] },
    ],
  },
];

async function main() {
  console.log("Clearing existing catalogue…");
  await prisma.orderItem.deleteMany();
  await prisma.fulfilment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.review.deleteMany();
  await prisma.price.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();

  console.log("Seeding categories and brands…");
  const categories = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.category.create({ data: category });
    categories.set(row.slug, row.id);
  }

  const brands = new Map<string, string>();
  for (const brand of BRANDS) {
    const row = await prisma.brand.create({ data: brand });
    brands.set(row.name, row.id);
  }

  console.log(`Seeding ${PRODUCTS.length} products…`);
  for (const product of PRODUCTS) {
    const categoryId = categories.get(product.category);
    const brandId = brands.get(product.brand);
    if (!categoryId) throw new Error(`Unknown category: ${product.category}`);
    if (!brandId) throw new Error(`Unknown brand: ${product.brand}`);

    await prisma.product.create({
      data: {
        slug: product.slug,
        name: product.name,
        kind: "LICENCE",
        brandId,
        categoryId,
        summary: product.summary,
        bullets: product.bullets,
        specs: product.specs,
        sacCode: "997331",
        gstRatePercent: 18,
        term: product.term,
        glyph: "licence",
        featured: product.featured ?? false,
        variants: {
          create: product.variants.map((variant) => ({
            sku: variant.sku,
            name: variant.name,
            seats: variant.seats,
            prices: {
              create: [
                {
                  currency: "USD",
                  listMinor: variant.usd[0] * 100,
                  priceMinor: variant.usd[1] * 100,
                },
                {
                  currency: "INR",
                  listMinor: variant.inr[0] * 100,
                  priceMinor: variant.inr[1] * 100,
                },
              ],
            },
          })),
        },
        reviews: {
          create: (product.reviews ?? []).map((review) => ({
            author: review.author,
            country: review.country ?? null,
            rating: review.rating,
            title: review.title,
            body: review.body,
            verified: review.verified ?? false,
          })),
        },
      },
    });
  }

  console.log("Done.", {
    categories: await prisma.category.count(),
    brands: await prisma.brand.count(),
    products: await prisma.product.count(),
    variants: await prisma.variant.count(),
    prices: await prisma.price.count(),
    reviews: await prisma.review.count(),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
