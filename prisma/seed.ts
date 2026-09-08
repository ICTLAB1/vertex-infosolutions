/**
 * The catalogue.
 *
 * Microsoft comes from the real price book: `microsoft.ts` builds it from the
 * distributor list in `data/`, so those prices are Microsoft's published India
 * list price plus GST, not an invention.
 *
 * Adobe comes from the VIP channel list on the same basis, at the 1-9 seat
 * band.
 *
 * Autodesk carries no price. Those listings are quote-only: they hold no
 * `Price` row at all, and every surface asks the customer for a seat count
 * instead of showing a figure. That is the honest state of a range whose price
 * book we do not hold — the alternative, and what was here before, was eleven
 * listings priced from imagination, which is not a display bug but a contract
 * somebody can hold the shop to. Add the prices and clear `quoteOnly` when the
 * price book arrives.
 *
 * INR prices are GST-inclusive, because that is what an Indian buyer expects to
 * see and what the law requires be displayed. USD prices carry no Indian tax at
 * all — those sales are exports.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

import type { SeedProduct } from "./catalogue-types";
import { ADOBE_PRODUCTS } from "./adobe";
import { MICROSOFT_PRODUCTS, MICROSOFT_TOO_LARGE } from "./microsoft";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  {
    slug: "productivity",
    name: "Productivity & collaboration",
    blurb: "Email, documents and meetings for a whole team.",
    intro:
      "Email, documents, meetings and the shared storage behind them — Microsoft 365 and Office 365 in every plan Microsoft publishes, plus the Teams, Exchange and SharePoint add-ons that extend them. The choice most buyers get wrong is Business versus Enterprise: Business plans stop at 300 users and Enterprise plans have no cap, and no amount of feature comparison matters if you cross that line. The second is Microsoft 365 versus Office 365 — the first adds Windows and device management rights, the second does not, and they are priced accordingly. Every plan here is a twelve-month commercial subscription bought through the Cloud Solution Provider programme, which means the seats arrive in a Microsoft tenant we create for the order rather than in one you already run. Nothing renews on its own; we email you a month before a term ends.",
    position: 1,
  },
  {
    slug: "creative",
    name: "Creative & design",
    blurb: "Design, photography, video and 3D.",
    intro:
      "Adobe's design range licensed for organisations rather than for individuals — Creative Cloud, Photoshop, Illustrator, InDesign, Premiere Pro, After Effects, Acrobat and the Substance 3D tools, in the for-teams and for-enterprise editions. The difference from a personal subscription is the part that matters at work: a teams licence is assigned to a named user from your own Adobe Admin Console, so it can be reassigned when somebody leaves, and it carries the deployment and licensing terms an audit asks about. Prices on this shelf are Adobe's 1–9 seat band, which is what a buyer of a single seat actually pays. From ten seats the band price is lower and the licensing is cleaner on one order, so every listing points at a quote rather than quietly overcharging you through the basket.",
    position: 2,
  },
  {
    slug: "cad",
    name: "Engineering & CAD",
    blurb: "Drafting, modelling and simulation.",
    intro:
      "Drafting, modelling, simulation and the collections that bundle them — AutoCAD, AutoCAD LT, Revit, Civil 3D, Inventor, Fusion, Maya, 3ds Max and the Architecture, Engineering & Construction and Product Design & Manufacturing collections. Autodesk licences are named-user subscriptions assigned in your own Autodesk account, not machine keys, which is why a seat can move between people and between computers within the terms. These listings carry no price. Autodesk is supplied under a reseller agreement whose price book we do not publish, and a number invented to fill the gap would be worse than asking — so every one of them goes to a quote, answered within one business day, with the term and the seat count you actually need.",
    position: 3,
  },
  {
    slug: "servers",
    name: "Operating systems & servers",
    blurb: "Desktop and server operating systems.",
    intro:
      "Operating systems licensed by the device, the user or the core, which is where most of the confusion on this shelf comes from. Windows Server is licensed per physical core with a sixteen-core minimum per server, and every user or device that connects also needs a Client Access Licence — the server licence alone is not enough to be compliant, and it is the single most common finding in a Microsoft audit. Windows 10 and 11 Enterprise are per-user subscriptions rather than the retail copy that comes with a laptop. Extended Security Updates appear here too, for organisations still running a version Microsoft has stopped supporting; they are sold by the year and the price rises each year on purpose.",
    position: 4,
  },
  {
    slug: "analytics",
    name: "Analytics & planning",
    blurb: "Reporting, diagramming and project management.",
    intro:
      "Reporting, diagramming and project planning — Power BI Pro and Premium Per User, Visio Plan 1 and Plan 2, Project Plan 1, 3 and 5, and the capacity add-ons that go with them. Two things decide the cost here and neither is obvious from a feature list. Power BI Premium Per User is licensed to a person, while Premium capacity is licensed to the organisation and changes who has to hold a licence to read a report. And Visio and Project each come in a web-only plan and a desktop plan at very different prices, so a team that only needs to open and comment on a file rarely needs the plan it was quoted.",
    position: 5,
  },
  {
    slug: "business-apps",
    name: "Business applications",
    blurb: "Dynamics 365, Business Central and the Power Platform.",
    intro:
      "Dynamics 365, Business Central and the Power Platform — the applications that run a finance function, a sales team, a service desk or a warehouse. Dynamics licensing works on a base-and-attach model that is worth understanding before you buy: the first application a user gets is a Base licence and every additional one is an Attach licence at a much lower price, so the order in which they are bought changes the total. Business Central splits into Essentials and Premium, and Premium is the one that includes manufacturing and service management. Power Apps, Power Automate and Power Pages are sold per user, per app or by consumption, and the wrong one of those three is the most expensive mistake on this shelf.",
    position: 6,
  },
  {
    slug: "security",
    name: "Security & identity",
    blurb: "Defender, Entra, Intune, Purview and compliance.",
    intro:
      "Identity, device management, threat protection and compliance — Microsoft Defender, Entra ID, Intune, Purview and the suites that combine them. Most of these are also included in a Microsoft 365 plan you may already hold, so the first question is not which to buy but which you are already paying for: Entra ID P1 and Intune Plan 1 are in Business Premium and E3, and Entra ID P2 and Defender for Endpoint P2 are in E5. Buying them again as standalone licences is common and avoidable. What is genuinely standalone here are the add-ons — extended audit log retention, Insider Risk forensic evidence, Defender for IoT — which no bundle includes.",
    position: 7,
  },
  {
    slug: "cloud-desktop",
    name: "Cloud PCs & virtual desktops",
    blurb: "Windows 365 and Azure Virtual Desktop.",
    intro:
      "A Windows desktop that runs in Microsoft's datacentre rather than on a laptop — Windows 365 Cloud PCs in the Business, Enterprise and Frontline editions, and Azure Virtual Desktop. Windows 365 is a fixed monthly price per user for a named machine of a stated size, which is the reason to choose it: the bill does not change with usage and the sizing is the only decision. Azure Virtual Desktop is the opposite trade — shared session hosts billed on Azure consumption, cheaper at scale and harder to predict. Frontline is the one most people have not heard of and the one that suits shift work, because the licence covers several people using the same Cloud PC at different times rather than one person owning it.",
    position: 8,
  },
];

const BRANDS = [
  {
    name: "Microsoft",
    slug: "microsoft",
    blurb: "Microsoft 365, Windows, Windows Server and the Power Platform.",
    intro:
      "Every Microsoft licence here is a commercial subscription bought through the Cloud Solution Provider programme, and one consequence of that is worth knowing before you order: the seats arrive in a Microsoft tenant we provision for you, with its own tenant ID and global administrator sign-in. A CSP subscription is bought in the region the reseller trades in and cannot be attached to a tenant that already exists in another one — so if you have existing Microsoft users, mailboxes and data, they stay where they are and this is a separate tenant beside them. That is stated on every product page, in the basket and again at checkout, because somebody expecting new seats to appear beside their existing users has bought the wrong thing. Vertex is a Microsoft Solutions Partner; every listing carries Microsoft's own product and SKU identifiers so you can check the item against a quote from anyone else.",
  },
  {
    name: "Adobe",
    slug: "adobe",
    blurb: "Creative Cloud, Acrobat and Substance 3D, licensed for teams.",
    intro:
      "Adobe licences supplied under our certified reseller agreement, through the Value Incentive Plan — the volume programme organisations buy on, as distinct from the personal subscription sold at adobe.com. Seats are assigned to named users in your own Adobe Admin Console, which is what lets a licence be reassigned when somebody leaves rather than being lost with them. Prices shown are Adobe's 1–9 seat band. Adobe genuinely prices lower at 10, 50 and 100 seats, so a team buying twenty seats through the basket at the single-seat price would be paying more than Adobe's own list; every listing says so and points at a quote instead. Each carries Adobe's part number exactly as their price list prints it, which is the number a purchase order quotes.",
  },
  {
    name: "Autodesk",
    slug: "autodesk",
    blurb: "AutoCAD, Revit, Fusion and the media and entertainment range.",
    intro:
      "Autodesk subscriptions assigned to your own Autodesk account and allocated to named users. These listings deliberately carry no price. We hold a reseller agreement with Autodesk but not a published price book we are free to reprint, and the alternative to leaving the field empty was inventing a number — so every Autodesk product here goes to a quote instead, answered within one business day. That is slower than a basket and more honest than the alternative. Tell us the product, the term and how many seats, and the quote comes back with the licensing arrangement written out, so the number can be checked against Autodesk's own and against anybody else's.",
  },
];

const PRODUCTS: SeedProduct[] = [
  // Both ranges come from the real price books rather than from imagination.
  ...MICROSOFT_PRODUCTS,
  ...ADOBE_PRODUCTS,

  // -------------------------------------------------------------------- Adobe

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
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows, macOS, web, mobile",
      Reassignable: "Yes, through the Autodesk account portal",
    },
    featured: true,
    quoteOnly: true,
    variants: [
      { sku: "ADSK-ACAD-1Y", name: "1 user, 1 year", seats: 1 },
      { sku: "ADSK-ACAD-3Y", name: "1 user, 3 years", seats: 1 },
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
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows, macOS, web, mobile",
    },
    quoteOnly: true,
    variants: [{ sku: "ADSK-ACADLT-1Y", name: "1 user, 1 year", seats: 1 }],
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
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows",
    },
    featured: true,
    quoteOnly: true,
    variants: [{ sku: "ADSK-REVIT-1Y", name: "1 user, 1 year", seats: 1 }],
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
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows, macOS",
    },
    quoteOnly: true,
    variants: [
      { sku: "ADSK-FUSION-1Y", name: "1 user, 1 year", seats: 1 },
      { sku: "ADSK-FUSION-3Y", name: "1 user, 3 years", seats: 1 },
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
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows, macOS, Linux",
    },
    quoteOnly: true,
    variants: [{ sku: "ADSK-MAYA-1Y", name: "1 user, 1 year", seats: 1 }],
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
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows",
    },
    quoteOnly: true,
    variants: [{ sku: "ADSK-INV-1Y", name: "1 user, 1 year", seats: 1 }],
  },

  // ------------------------------------------------------ Adobe (continued)

  // --------------------------------------------------- Autodesk (continued)
  {
    slug: "autodesk-civil-3d",
    name: "Autodesk Civil 3D",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Civil engineering design and documentation for roads, drainage and land development.",
    bullets: [
      "Corridor, grading and pipe network design",
      "Surface modelling and earthwork quantities",
      "Includes AutoCAD and the industry toolsets",
      "Dynamic documentation from the design model",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows",
    },
    quoteOnly: true,
    variants: [{ sku: "ADSK-C3D-1Y", name: "1 user, 1 year", seats: 1 }],
  },
  {
    slug: "autodesk-3ds-max",
    name: "Autodesk 3ds Max",
    brand: "Autodesk",
    category: "creative",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "3D modelling, rendering and animation for design visualisation and games.",
    bullets: [
      "Polygon and spline modelling with modifier stack",
      "Arnold renderer with 5 licences included",
      "Chaos and V-Ray compatible",
      "Strong architectural visualisation toolset",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows",
    },
    quoteOnly: true,
    variants: [{ sku: "ADSK-3DSMAX-1Y", name: "1 user, 1 year", seats: 1 }],
  },
  {
    slug: "autodesk-navisworks-manage",
    name: "Autodesk Navisworks Manage",
    brand: "Autodesk",
    category: "cad",
    term: "ANNUAL_SUBSCRIPTION",
    summary:
      "Model coordination and clash detection across every discipline on a project.",
    bullets: [
      "Clash detection between combined discipline models",
      "4D and 5D simulation from the programme",
      "Aggregates models from Revit, AutoCAD, Civil 3D and IFC",
      "Quantification for take-off",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows",
    },
    quoteOnly: true,
    variants: [{ sku: "ADSK-NWM-1Y", name: "1 user, 1 year", seats: 1 }],
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
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows",
    },
    featured: true,
    quoteOnly: true,
    variants: [
      { sku: "ADSK-AEC-1Y", name: "1 user, 1 year", seats: 1 },
      { sku: "ADSK-AEC-3Y", name: "1 user, 3 years", seats: 1 },
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
      Delivery: "Electronic — assigned within one business day",
      Platform: "Windows",
    },
    quoteOnly: true,
    variants: [{ sku: "ADSK-PDMC-1Y", name: "1 user, 1 year", seats: 1 }],
  },
];

/**
 * Whether this run may go ahead.
 *
 * Seeding used to delete every order, basket and product before it wrote,
 * which was right on an empty database and catastrophic on one with a
 * customer's orders in it — and the refusal message told whoever hit it to run
 * again with `--force`, which is exactly the wrong advice for the person it
 * was protecting.
 *
 * It no longer deletes anything a customer created. What is left to guard
 * against is pointing it at a database whose catalogue somebody has been
 * editing by hand: this file is the source of truth for a listing's name, its
 * copy and its price, so a run overwrites those. Orders, baskets, reviews and
 * accounts are never touched, by this or by `--force`.
 */
async function safeToSeed(): Promise<boolean> {
  if (process.argv.includes("--force") || process.env.SEED_FORCE === "1") {
    return true;
  }

  const products = await prisma.product.count();
  if (products === 0) return true;

  console.log(
    `This database already holds ${products} products, so it has not been touched.\n` +
      "Seeding rewrites every listing's name, copy and price from this file.\n" +
      "Orders, baskets, reviews and accounts are never touched.\n" +
      "If that is what you want, run it again with --force.",
  );
  return false;
}

async function main() {
  if (!(await safeToSeed())) return;

  console.log("Categories and brands…");
  const categories = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: category,
    });
    categories.set(row.slug, row.id);
  }

  const brands = new Map<string, string>();
  for (const brand of BRANDS) {
    const row = await prisma.brand.upsert({
      where: { slug: brand.slug },
      create: brand,
      update: brand,
    });
    brands.set(row.name, row.id);
  }

  console.log(`${PRODUCTS.length} products…`);
  for (const product of PRODUCTS) {
    const categoryId = categories.get(product.category);
    const brandId = brands.get(product.brand);
    if (!categoryId) throw new Error(`Unknown category: ${product.category}`);
    if (!brandId) throw new Error(`Unknown brand: ${product.brand}`);

    // Everything this file is the source of truth for. `published` is not in
    // the list: taking a listing down is a decision somebody made in the back
    // office, and a routine catalogue refresh must not quietly undo it.
    const fields = {
      name: product.name,
      kind: "LICENCE" as const,
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
      logo: product.logo ?? null,
      cspNewTenant: product.cspNewTenant ?? false,
      quoteOnly: product.quoteOnly ?? false,
    };

    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      create: { slug: product.slug, ...fields },
      update: fields,
      select: { id: true },
    });

    for (const variant of product.variants) {
      const shape = {
        productId: row.id,
        partNumber: variant.partNumber ?? null,
        name: variant.name,
        seats: variant.seats,
      };
      const saved = await prisma.variant.upsert({
        where: { sku: variant.sku },
        create: { sku: variant.sku, ...shape },
        update: shape,
        select: { id: true },
      });

      const money: [string, [number, number] | undefined][] = [
        ["USD", variant.usd],
        ["INR", variant.inr],
      ];
      for (const [currency, figures] of money) {
        if (!figures) {
          // No figure in this currency means no row, not a stale one. This is
          // how a listing becomes quote-only on a database that already holds
          // prices for it: the rows go, and there is nothing left to render.
          // Deleting a price never touches an order — an order line copies the
          // amount it was sold at.
          await prisma.price.deleteMany({
            where: { variantId: saved.id, currency },
          });
          continue;
        }
        const amounts = {
          listMinor: figures[0] * 100,
          priceMinor: figures[1] * 100,
        };
        await prisma.price.upsert({
          where: { variantId_currency: { variantId: saved.id, currency } },
          create: { variantId: saved.id, currency, ...amounts },
          update: amounts,
        });
      }
    }

    // A SKU this file no longer lists stops being purchasable but keeps its
    // row, because an order line points at it. With no price in either market
    // it is simply not sold anywhere.
    await prisma.price.deleteMany({
      where: {
        variant: {
          productId: row.id,
          sku: { notIn: product.variants.map((v) => v.sku) },
        },
      },
    });
  }

  // A listing that has left the price book is withdrawn rather than deleted:
  // deleting would take its order lines with it and make an old invoice
  // unexplainable. Withdrawn is exactly the state the back office already
  // understands, and somebody can put it back.
  const retired = await prisma.product.updateMany({
    where: { slug: { notIn: PRODUCTS.map((p) => p.slug) }, published: true },
    data: { published: false },
  });
  if (retired.count > 0) {
    console.log(
      `${retired.count} ${retired.count === 1 ? "listing is" : "listings are"} no longer in the price book and ${retired.count === 1 ? "has" : "have"} been withdrawn. ${retired.count === 1 ? "It keeps its orders and its history" : "They keep their orders and their history"}, and the back office can put ${retired.count === 1 ? "it" : "them"} back.`,
    );
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
      "Adobe prices come from the VIP channel list dated 6 September 2026, on the same basis, and are the 1-9 seat band.\n" +
      "Autodesk carries no price at all. Those listings are quote-only: they hold no Price row, so nothing can render or charge a figure for them, and every surface sends the customer to the enquiry form instead. Add the prices and clear quoteOnly when the Autodesk price book arrives.",
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
