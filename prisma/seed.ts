/**
 * The catalogue.
 *
 * Microsoft comes from the real price book: `microsoft.ts` builds it from the
 * distributor list in `data/`, so those prices are Microsoft's published India
 * list price plus GST, not an invention.
 *
 * Adobe and Autodesk are still samples. Their prices are shaped like real ones
 * and are not real ones — the INR figure is not the USD figure converted,
 * because publishers price India as its own market and pretending otherwise
 * produces a catalogue that looks plausible and prices nothing correctly.
 * Replace them as each price book arrives.
 *
 * INR prices are GST-inclusive, because that is what an Indian buyer expects to
 * see and what the law requires be displayed. USD prices carry no Indian tax at
 * all — those sales are exports.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

import type { SeedProduct } from "./catalogue-types";
import { MICROSOFT_PRODUCTS, MICROSOFT_TOO_LARGE } from "./microsoft";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });



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
  {
    slug: "business-apps",
    name: "Business applications",
    blurb: "Dynamics 365, Business Central and the Power Platform.",
    position: 6,
  },
  {
    slug: "security",
    name: "Security & identity",
    blurb: "Defender, Entra, Intune, Purview and compliance.",
    position: 7,
  },
  {
    slug: "cloud-desktop",
    name: "Cloud PCs & virtual desktops",
    blurb: "Windows 365 and Azure Virtual Desktop.",
    position: 8,
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
  // The Microsoft range, from the price book rather than from imagination.
  ...MICROSOFT_PRODUCTS,


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


  // ------------------------------------------------------ Adobe (continued)
  {
    slug: "adobe-photoshop-teams",
    name: "Adobe Photoshop for Teams",
    brand: "Adobe",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary: "Photoshop on desktop, web and iPad, licensed per seat with the admin console.",
    bullets: [
      "Photoshop on desktop, web and iPad",
      "Generative Fill and the Firefly generative credits",
      "100 GB of cloud storage per seat",
      "Admin console for reassigning seats",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      Delivery: "Electronic — seat assigned on payment",
      Platform: "Windows, macOS, iPadOS, web",
    },
    variants: [
      { sku: "ADB-PS-1S", name: "1 seat, 1 year", seats: 1, usd: [440, 408], inr: [30500, 28800] },
      { sku: "ADB-PS-5S", name: "5 seats, 1 year", seats: 5, usd: [2200, 1950], inr: [152500, 137000] },
    ],
  },
  {
    slug: "adobe-illustrator-teams",
    name: "Adobe Illustrator for Teams",
    brand: "Adobe",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary: "Vector drawing and illustration on desktop, web and iPad, per seat.",
    bullets: [
      "Illustrator on desktop, web and iPad",
      "Generative vector tools",
      "100 GB of cloud storage per seat",
      "Admin console for reassigning seats",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      Delivery: "Electronic — seat assigned on payment",
      Platform: "Windows, macOS, iPadOS, web",
    },
    variants: [
      { sku: "ADB-AI-1S", name: "1 seat, 1 year", seats: 1, usd: [440, 408], inr: [30500, 28800] },
    ],
  },
  {
    slug: "adobe-premiere-pro-teams",
    name: "Adobe Premiere Pro for Teams",
    brand: "Adobe",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary: "Video editing with Frame.io review built in, licensed per seat.",
    bullets: [
      "Premiere Pro with the Frame.io V4 review workflow",
      "Text-based editing and automatic transcription",
      "100 GB of cloud storage per seat",
      "Includes Adobe Media Encoder",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      Delivery: "Electronic — seat assigned on payment",
      Platform: "Windows, macOS",
    },
    variants: [
      { sku: "ADB-PPRO-1S", name: "1 seat, 1 year", seats: 1, usd: [440, 408], inr: [30500, 28800] },
    ],
  },
  {
    slug: "adobe-indesign-teams",
    name: "Adobe InDesign for Teams",
    brand: "Adobe",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary: "Page layout for print and digital publishing, licensed per seat.",
    bullets: [
      "Long-document layout, styles and master pages",
      "Print-ready PDF export with preflight",
      "Interactive and fixed-layout digital publishing",
      "100 GB of cloud storage per seat",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      Delivery: "Electronic — seat assigned on payment",
      Platform: "Windows, macOS",
    },
    variants: [
      { sku: "ADB-INDD-1S", name: "1 seat, 1 year", seats: 1, usd: [440, 408], inr: [30500, 28800] },
    ],
  },
  {
    slug: "adobe-express-teams",
    name: "Adobe Express for Teams",
    brand: "Adobe",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Quick on-brand design for people who are not designers — templates, brand kits and scheduling.",
    bullets: [
      "Templates, brand kits and locked brand controls",
      "Generative Fill and Text to Image, commercially safe",
      "Schedule to social channels",
      "Far cheaper than a Creative Cloud seat for occasional users",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      Delivery: "Electronic — seat assigned on payment",
      Platform: "Web, iOS, Android",
    },
    variants: [
      { sku: "ADB-EXPR-1S", name: "1 seat, 1 year", seats: 1, usd: [120, 108], inr: [8400, 7700] },
      { sku: "ADB-EXPR-10S", name: "10 seats, 1 year", seats: 10, usd: [1200, 1020], inr: [84000, 72500] },
    ],
  },

  // --------------------------------------------------- Autodesk (continued)
  {
    slug: "autodesk-civil-3d",
    name: "Autodesk Civil 3D",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary: "Civil engineering design and documentation for roads, drainage and land development.",
    bullets: [
      "Corridor, grading and pipe network design",
      "Surface modelling and earthwork quantities",
      "Includes AutoCAD and the industry toolsets",
      "Dynamic documentation from the design model",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows",
    },
    variants: [
      { sku: "ADSK-C3D-1Y", name: "1 user, 1 year", seats: 1, usd: [3190, 2900], inr: [237000, 217000] },
    ],
  },
  {
    slug: "autodesk-3ds-max",
    name: "Autodesk 3ds Max",
    brand: "Autodesk",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary: "3D modelling, rendering and animation for design visualisation and games.",
    bullets: [
      "Polygon and spline modelling with modifier stack",
      "Arnold renderer with 5 licences included",
      "Chaos and V-Ray compatible",
      "Strong architectural visualisation toolset",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows",
    },
    variants: [
      { sku: "ADSK-3DSMAX-1Y", name: "1 user, 1 year", seats: 1, usd: [2400, 2190], inr: [179000, 164000] },
    ],
  },
  {
    slug: "autodesk-navisworks-manage",
    name: "Autodesk Navisworks Manage",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary: "Model coordination and clash detection across every discipline on a project.",
    bullets: [
      "Clash detection between combined discipline models",
      "4D and 5D simulation from the programme",
      "Aggregates models from Revit, AutoCAD, Civil 3D and IFC",
      "Quantification for take-off",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows",
    },
    variants: [
      { sku: "ADSK-NWM-1Y", name: "1 user, 1 year", seats: 1, usd: [3060, 2790], inr: [227000, 208000] },
    ],
  },
  {
    slug: "autodesk-architecture-engineering-construction-collection",
    name: "Autodesk AEC Collection",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Revit, Civil 3D, AutoCAD, Navisworks and more in one licence — the way most firms actually buy Autodesk.",
    bullets: [
      "Revit, Civil 3D, AutoCAD with toolsets, Navisworks Manage, InfraWorks, 3ds Max",
      "One named-user licence covering all of them",
      "Substantially cheaper than two of the products bought separately",
      "Includes Autodesk Docs for common data environment",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows",
    },
    featured: true,
    variants: [
      { sku: "ADSK-AEC-1Y", name: "1 user, 1 year", seats: 1, usd: [3550, 3240], inr: [264000, 242000] },
      { sku: "ADSK-AEC-3Y", name: "1 user, 3 years", seats: 1, usd: [10100, 8750], inr: [750000, 652000] },
    ],
    reviews: [
      { author: "Practice Director", country: "India", rating: 5, title: "Cheaper than Revit and Civil 3D separately", body: "We were buying two products per seat. The collection costs less than that and adds Navisworks, which we now use on every job.", verified: true },
    ],
  },
  {
    slug: "autodesk-product-design-manufacturing-collection",
    name: "Autodesk Product Design & Manufacturing Collection",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Inventor, AutoCAD, Fusion, Nastran and Vault in one licence for manufacturing teams.",
    bullets: [
      "Inventor Professional, AutoCAD, Fusion, Navisworks Manage",
      "Inventor Nastran and CFD for simulation",
      "Vault Basic for data management",
      "One named-user licence covering all of them",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment",
      Platform: "Windows",
    },
    variants: [
      { sku: "ADSK-PDMC-1Y", name: "1 user, 1 year", seats: 1, usd: [3550, 3240], inr: [264000, 242000] },
    ],
  },
];


/**
 * Whether it is safe to wipe what is there.
 *
 * This script deletes every order, basket and product before it writes, which
 * is exactly right on an empty database and catastrophic on one with a
 * customer's orders in it. Run against a populated database it stops and says
 * so, so that pointing it at the wrong `DATABASE_URL` — the deployed one,
 * say — costs nothing.
 *
 * `--force`, or SEED_FORCE=1, overrides it. Reseeding a development database
 * is an ordinary thing to want.
 */
async function safeToSeed(): Promise<boolean> {
  if (process.argv.includes("--force") || process.env.SEED_FORCE === "1") {
    return true;
  }

  const [products, orders] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
  ]);
  if (products === 0 && orders === 0) return true;

  console.log(
    `This database already holds ${products} products and ${orders} orders, so it has not been touched.\n` +
      "Seeding deletes every order, basket and product before it writes.\n" +
      "If that is genuinely what you want, run it again with --force.",
  );
  return false;
}

async function main() {
  if (!(await safeToSeed())) return;

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
  if (MICROSOFT_TOO_LARGE.length > 0) {
    console.log(
      `\n${MICROSOFT_TOO_LARGE.length} Microsoft SKUs were left out: their price is more than the order tables can hold (the ceiling is about two crore rupees).`,
    );
    for (const sku of MICROSOFT_TOO_LARGE) {
      console.log(`  - ${sku.title} (INR ${sku.inr.toLocaleString("en-IN")})`);
    }
  }

  console.log(
    "\nMicrosoft prices come from the September 2026 India price book: list price plus 18% GST for India, and the same figure before GST converted at the rate in microsoft.ts for export.\n" +
      "Adobe and Autodesk are still sample prices — shaped like real ones, and not real ones. Replace them before taking an order for either.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
