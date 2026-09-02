/**
 * Sample catalogue.
 *
 * Everything here is illustrative — plausible IT reseller stock at plausible
 * international street prices in USD, so the storefront can be judged with
 * something that looks like real inventory rather than "Product 1". Replace it
 * with the real catalogue before the store goes anywhere near a customer.
 *
 * Physical goods carry an HS code and a country of origin because both are
 * printed on the commercial invoice that travels with the parcel. Licences
 * carry neither: nothing crosses a border.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

type SeedVariant = {
  sku: string;
  name: string;
  list: number;
  price: number;
  stock?: number | null;
  leadDays?: number | null;
  grams?: number | null;
};

type SeedProduct = {
  slug: string;
  name: string;
  kind: "PHYSICAL" | "LICENCE";
  brand: string;
  category: string;
  summary: string;
  bullets: string[];
  specs: Record<string, string>;
  hsCode?: string;
  origin?: string;
  glyph: string;
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
  { slug: "laptops", name: "Laptops", position: 1 },
  { slug: "monitors", name: "Monitors", position: 2 },
  { slug: "printers", name: "Printers & Scanners", position: 3 },
  { slug: "networking", name: "Networking", position: 4 },
  { slug: "storage", name: "Storage & Power", position: 5 },
  { slug: "software", name: "Software", position: 6 },
];

const BRANDS = [
  "Dell", "HP", "Lenovo", "Samsung", "LG", "Canon", "Epson", "TP-Link",
  "Ubiquiti", "Seagate", "APC", "Microsoft", "Adobe", "Autodesk", "Veeam",
  "Logitech",
];

/** Dollars in, cents out. */
const D = (dollars: number) => Math.round(dollars * 100);

const PRODUCTS: SeedProduct[] = [
  {
    slug: "dell-latitude-3550-business-laptop",
    name: "Dell Latitude 3550 Business Laptop",
    kind: "PHYSICAL",
    brand: "Dell",
    category: "laptops",
    summary:
      "15.6-inch business laptop with Intel Core Ultra 5, built for long deployments and easy servicing.",
    bullets: [
      "Intel Core Ultra 5 125U, 12 cores, up to 4.3 GHz",
      "15.6-inch FHD (1920 x 1080) anti-glare, 250 nits",
      "Serviceable RAM and M.2 slots — no soldered storage",
      "Windows 11 Pro pre-installed, with a 3-year onsite warranty option",
      "Spill-resistant keyboard and a 54 Wh battery",
    ],
    specs: {
      Processor: "Intel Core Ultra 5 125U",
      Memory: "16 GB DDR5 (2 slots, up to 64 GB)",
      Storage: "512 GB PCIe NVMe SSD",
      Display: "15.6-inch FHD anti-glare",
      Ports: "2 x USB-C (Thunderbolt 4), 2 x USB-A, HDMI 2.1, RJ-45",
      Weight: "1.79 kg",
      Warranty: "1 year international, upgradeable to onsite",
    },
    hsCode: "8471.30",
    origin: "China",
    glyph: "laptop",
    featured: true,
    variants: [
      { sku: "DEL-LAT3550-16-512", name: "16 GB RAM / 512 GB SSD", list: D(1149), price: D(899), stock: 12, leadDays: 1, grams: 2600 },
      { sku: "DEL-LAT3550-16-1TB", name: "16 GB RAM / 1 TB SSD", list: D(1279), price: D(999), stock: 6, leadDays: 1, grams: 2600 },
      { sku: "DEL-LAT3550-32-1TB", name: "32 GB RAM / 1 TB SSD", list: D(1479), price: D(1199), stock: 3, leadDays: 2, grams: 2600 },
    ],
    reviews: [
      { author: "Rakesh M.", country: "United Arab Emirates", rating: 5, title: "Exactly what our field team needed", body: "Bought nine of these for our service engineers. Six months in, no failures, and the RAM upgrade took ten minutes per machine. The anti-glare screen genuinely helps on site.", verified: true },
      { author: "Sneha P.", country: "Singapore", rating: 4, title: "Solid, but the screen is average", body: "No complaints about performance or build. The display is only 250 nits though, so it struggles near a window. Fine for office use.", verified: true },
      { author: "Daniel W.", country: "United States", rating: 4, title: "Good value against the T-series", body: "Two thirds the price of the ThinkPads we were quoted and the difference in daily use is small. Customs paperwork was correct, which is more than I can say for the last supplier.", verified: true },
    ],
  },
  {
    slug: "lenovo-thinkpad-e14-gen-6",
    name: "Lenovo ThinkPad E14 Gen 6",
    kind: "PHYSICAL",
    brand: "Lenovo",
    category: "laptops",
    summary:
      "14-inch AMD Ryzen ThinkPad with the keyboard the range is known for, at an entry-business price.",
    bullets: [
      "AMD Ryzen 7 7735HS, 8 cores / 16 threads",
      "14-inch WUXGA (1920 x 1200) IPS, 300 nits",
      "The classic ThinkPad keyboard and TrackPoint",
      "MIL-STD-810H tested chassis",
      "Windows 11 Pro, TPM 2.0, fingerprint reader",
    ],
    specs: {
      Processor: "AMD Ryzen 7 7735HS",
      Memory: "16 GB DDR5-5600",
      Storage: "512 GB PCIe Gen4 NVMe SSD",
      Display: "14-inch WUXGA IPS, 300 nits",
      Ports: "1 x USB-C 3.2, 1 x USB4, 2 x USB-A, HDMI 2.1, RJ-45",
      Weight: "1.41 kg",
      Warranty: "1 year international carry-in",
    },
    hsCode: "8471.30",
    origin: "China",
    glyph: "laptop",
    featured: true,
    variants: [
      { sku: "LEN-E14G6-16-512", name: "16 GB RAM / 512 GB SSD", list: D(1049), price: D(869), stock: 8, leadDays: 1, grams: 2200 },
      { sku: "LEN-E14G6-24-1TB", name: "24 GB RAM / 1 TB SSD", list: D(1259), price: D(1039), stock: 0, leadDays: 5, grams: 2200 },
    ],
    reviews: [
      { author: "Devika R.", country: "United Kingdom", rating: 5, title: "The keyboard is why you buy this", body: "Typing all day on this is genuinely comfortable in a way the Dells in our office are not. Runs cool too.", verified: true },
      { author: "Arun K.", country: "Australia", rating: 3, title: "Fan noise under load", body: "Performance is fine but the fan is audible whenever you push it. In a quiet office you notice. Otherwise a good machine.", verified: true },
    ],
  },
  {
    slug: "hp-probook-450-g11",
    name: "HP ProBook 450 G11",
    kind: "PHYSICAL",
    brand: "HP",
    category: "laptops",
    summary: "15.6-inch corporate workhorse with HP's Wolf Security firmware protection.",
    bullets: [
      "Intel Core Ultra 7 155U",
      "15.6-inch FHD IPS, 300 nits",
      "HP Wolf Security for Business, firmware-level",
      "Backlit keyboard with a numeric keypad",
      "51 Wh battery with 45-minute fast charge",
    ],
    specs: {
      Processor: "Intel Core Ultra 7 155U",
      Memory: "16 GB DDR5",
      Storage: "512 GB NVMe SSD",
      Display: "15.6-inch FHD IPS, 300 nits",
      Weight: "1.79 kg",
      Warranty: "1 year international",
    },
    hsCode: "8471.30",
    origin: "China",
    glyph: "laptop",
    variants: [
      { sku: "HP-PB450G11-16-512", name: "16 GB RAM / 512 GB SSD", list: D(1149), price: D(949), stock: 5, leadDays: 2, grams: 2500 },
    ],
    reviews: [
      { author: "Manish T.", country: "Qatar", rating: 4, title: "Does the job", body: "Standard corporate laptop, nothing surprising. Wolf Security was easy to roll out across the fleet.", verified: true },
    ],
  },
  {
    slug: "dell-ultrasharp-u2724d-27-monitor",
    name: 'Dell UltraSharp U2724D 27" QHD Monitor',
    kind: "PHYSICAL",
    brand: "Dell",
    category: "monitors",
    summary:
      "27-inch QHD IPS Black panel at 120 Hz, with USB-C power delivery and a genuinely good stand.",
    bullets: [
      "27-inch QHD (2560 x 1440) IPS Black, 120 Hz",
      "Contrast ratio 2000:1 — noticeably deeper blacks than standard IPS",
      "90 W USB-C power delivery — one cable for video, data and charging",
      "Height, tilt, swivel and pivot adjustment",
      "99% sRGB, factory calibrated to Delta-E < 2",
    ],
    specs: {
      "Panel size": "27 inches",
      Resolution: "2560 x 1440 (QHD)",
      "Refresh rate": "120 Hz",
      "Panel type": "IPS Black",
      Ports: "1 x HDMI 2.1, 1 x DisplayPort 1.4, 1 x USB-C (90 W), 4 x USB-A",
      Warranty: "3 years, with advance exchange",
    },
    hsCode: "8528.52",
    origin: "China",
    glyph: "monitor",
    featured: true,
    variants: [
      { sku: "DEL-U2724D", name: "27-inch QHD", list: D(619), price: D(509), stock: 14, leadDays: 1, grams: 7400 },
    ],
    reviews: [
      { author: "Priya N.", country: "Germany", rating: 5, title: "The single-cable setup is the selling point", body: "One USB-C to the laptop and everything works — display, keyboard, mouse, ethernet, charging. Cleared half the cables off my desk.", verified: true },
      { author: "Viktor J.", country: "Netherlands", rating: 5, title: "IPS Black is a real improvement", body: "Side by side with our older U2722D the blacks are visibly better. Worth the difference if you look at documents all day.", verified: true },
      { author: "Anonymous", country: "Canada", rating: 2, title: "Arrived with a stuck pixel", body: "Panel had one stuck pixel out of the box. Replacement was arranged without argument but it cost me two weeks including the return shipping.", verified: true },
    ],
  },
  {
    slug: "lg-27uq850v-27-4k-monitor",
    name: 'LG 27UQ850V 27" 4K UHD Monitor',
    kind: "PHYSICAL",
    brand: "LG",
    category: "monitors",
    summary: "27-inch 4K IPS with 95% DCI-P3 coverage and a built-in USB-C dock.",
    bullets: [
      "27-inch 4K UHD (3840 x 2160) IPS",
      "95% DCI-P3, VESA DisplayHDR 400",
      "90 W USB-C power delivery with an ethernet passthrough",
      "Ergonomic stand with pivot",
    ],
    specs: {
      "Panel size": "27 inches",
      Resolution: "3840 x 2160 (4K UHD)",
      "Panel type": "IPS",
      "Colour gamut": "95% DCI-P3",
      Warranty: "3 years",
    },
    hsCode: "8528.52",
    origin: "South Korea",
    glyph: "monitor",
    variants: [
      { sku: "LG-27UQ850V", name: "27-inch 4K", list: D(799), price: D(649), stock: 4, leadDays: 2, grams: 7800 },
    ],
    reviews: [
      { author: "Farah A.", country: "United Arab Emirates", rating: 4, title: "Great panel, mediocre menus", body: "Colour accuracy out of the box is excellent. The on-screen controls are fiddly but you only use them once.", verified: true },
    ],
  },
  {
    slug: "samsung-viewfinity-s6-34-ultrawide",
    name: 'Samsung ViewFinity S6 34" Ultrawide',
    kind: "PHYSICAL",
    brand: "Samsung",
    category: "monitors",
    summary: "34-inch curved ultrawide for people who keep three windows open at once.",
    bullets: [
      "34-inch WQHD (3440 x 1440) curved VA, 100 Hz",
      "Picture-by-picture from two inputs at once",
      "65 W USB-C power delivery",
      "1000R curvature",
    ],
    specs: {
      "Panel size": "34 inches",
      Resolution: "3440 x 1440",
      "Refresh rate": "100 Hz",
      Curvature: "1000R",
      Warranty: "3 years",
    },
    hsCode: "8528.52",
    origin: "Vietnam",
    glyph: "monitor",
    variants: [
      { sku: "SAM-S6-34UW", name: "34-inch WQHD", list: D(699), price: D(569), stock: 7, leadDays: 2, grams: 9600 },
    ],
  },
  {
    slug: "canon-imageclass-mf445dw",
    name: "Canon imageCLASS MF445dw Multifunction Printer",
    kind: "PHYSICAL",
    brand: "Canon",
    category: "printers",
    summary:
      "Monochrome laser MFP at 38 ppm with duplex scanning — the workgroup printer that stops being a topic of conversation.",
    bullets: [
      "38 pages per minute, first page in under 6 seconds",
      "Single-pass duplex ADF, 50 sheets",
      "Print, scan, copy and fax over ethernet or Wi-Fi",
      "Monthly duty cycle of 80,000 pages",
      "Standard toner yields 3,100 pages; high-yield 10,000",
    ],
    specs: {
      Technology: "Monochrome laser",
      Speed: "38 ppm",
      "Paper capacity": "250-sheet cassette + 100-sheet tray",
      Connectivity: "Gigabit ethernet, Wi-Fi, USB",
      "Duty cycle": "80,000 pages/month",
      Warranty: "1 year",
    },
    hsCode: "8443.31",
    origin: "Vietnam",
    glyph: "printer",
    variants: [
      { sku: "CAN-MF445DW", name: "Single unit", list: D(529), price: D(419), stock: 9, leadDays: 2, grams: 16400 },
    ],
    reviews: [
      { author: "Office Manager", country: "United Kingdom", rating: 5, title: "Fast and forgettable, in a good way", body: "Replaced an ageing unit that jammed weekly. This has done 14,000 pages without a single jam. Duplex scanning is quick.", verified: true },
      { author: "Sunil B.", country: "Kenya", rating: 4, title: "Toner is the real cost", body: "Printer is cheap, toner is not. Buy the high-yield cartridges from the start and the maths works out.", verified: true },
    ],
  },
  {
    slug: "epson-ecotank-l6580",
    name: "Epson EcoTank L6580 Colour MFP",
    kind: "PHYSICAL",
    brand: "Epson",
    category: "printers",
    summary: "Ink tank colour MFP with running costs low enough to change how a small office prints.",
    bullets: [
      "Refillable ink tanks — roughly 7,500 colour pages per set",
      "25 ppm mono, 12 ppm colour, A4 duplex",
      "PrecisionCore heat-free printhead",
      "Ethernet, Wi-Fi Direct and a 4.3-inch touchscreen",
    ],
    specs: {
      Technology: "Ink tank (EcoTank)",
      Speed: "25 ppm mono / 12 ppm colour",
      "Page yield": "7,500 colour / 6,000 mono per ink set",
      Connectivity: "Ethernet, Wi-Fi, USB",
      Warranty: "1 year or 30,000 pages",
    },
    hsCode: "8443.31",
    origin: "Indonesia",
    glyph: "printer",
    variants: [
      { sku: "EPS-L6580", name: "Single unit", list: D(649), price: D(529), stock: 6, leadDays: 3, grams: 13200 },
    ],
  },
  {
    slug: "ubiquiti-unifi-u7-pro-access-point",
    name: "Ubiquiti UniFi U7 Pro Access Point",
    kind: "PHYSICAL",
    brand: "Ubiquiti",
    category: "networking",
    summary: "Wi-Fi 7 ceiling access point managed from the UniFi controller, with no per-AP licensing.",
    bullets: [
      "Wi-Fi 7 (802.11be), 2.4 / 5 / 6 GHz tri-band",
      "Up to 300 connected clients",
      "PoE+ powered — one cable to the ceiling",
      "No subscription or per-device licence",
      "Managed alongside every other UniFi device in one controller",
    ],
    specs: {
      Standard: "Wi-Fi 7 (802.11be)",
      Bands: "2.4 GHz / 5 GHz / 6 GHz",
      Uplink: "2.5 GbE",
      Power: "PoE+ (802.3at)",
      Coverage: "Up to 140 m² indoors",
      Warranty: "1 year",
    },
    hsCode: "8517.62",
    origin: "Vietnam",
    glyph: "router",
    featured: true,
    variants: [
      { sku: "UBI-U7-PRO", name: "Single access point", list: D(229), price: D(199), stock: 22, leadDays: 1, grams: 900 },
      { sku: "UBI-U7-PRO-5PK", name: "5-pack", list: D(1145), price: D(949), stock: 4, leadDays: 3, grams: 4200 },
    ],
    reviews: [
      { author: "Nikhil D.", country: "Singapore", rating: 5, title: "Replaced six APs across two floors", body: "Roaming is seamless now and the controller makes troubleshooting actually possible. No licence fees is the reason we moved.", verified: true },
      { author: "Tom R.", country: "United States", rating: 4, title: "You need the PoE budget", body: "Works exactly as advertised, but check your switch has the PoE+ headroom before ordering five of them. Ours did not.", verified: true },
    ],
  },
  {
    slug: "tp-link-omada-sg3428x-switch",
    name: "TP-Link Omada SG3428X 24-Port Managed Switch",
    kind: "PHYSICAL",
    brand: "TP-Link",
    category: "networking",
    summary: "24-port gigabit L2+ managed switch with four 10G SFP+ uplinks.",
    bullets: [
      "24 x gigabit RJ-45 + 4 x 10G SFP+ uplinks",
      "L2+ static routing, VLANs, LACP, QoS",
      "Managed through the Omada controller or standalone",
      "Rack-mount, fanless below 40% load",
    ],
    specs: {
      Ports: "24 x 1G RJ-45, 4 x 10G SFP+",
      Switching: "128 Gbps capacity",
      Management: "Omada SDN, web UI, CLI",
      Form: "1U rack-mount",
      Warranty: "3 years",
    },
    hsCode: "8517.62",
    origin: "China",
    glyph: "router",
    variants: [
      { sku: "TPL-SG3428X", name: "24-port", list: D(399), price: D(319), stock: 5, leadDays: 2, grams: 3900 },
    ],
  },
  {
    slug: "samsung-990-evo-plus-nvme-ssd",
    name: "Samsung 990 EVO Plus NVMe SSD",
    kind: "PHYSICAL",
    brand: "Samsung",
    category: "storage",
    summary: "PCIe Gen5 M.2 drive at up to 7,250 MB/s, with a five-year warranty.",
    bullets: [
      "Sequential read up to 7,250 MB/s",
      "PCIe 4.0 x4 and 5.0 x2 compatible",
      "Samsung V-NAND TLC with a dynamic write cache",
      "5-year limited warranty or the rated TBW",
    ],
    specs: {
      Interface: "M.2 2280 NVMe, PCIe Gen5 x2 / Gen4 x4",
      "Read speed": "Up to 7,250 MB/s",
      "Write speed": "Up to 6,300 MB/s",
      Endurance: "600 TBW (1 TB)",
      Warranty: "5 years",
    },
    hsCode: "8523.51",
    origin: "South Korea",
    glyph: "ssd",
    variants: [
      { sku: "SAM-990EP-1TB", name: "1 TB", list: D(139), price: D(99), stock: 40, leadDays: 1, grams: 120 },
      { sku: "SAM-990EP-2TB", name: "2 TB", list: D(249), price: D(179), stock: 18, leadDays: 1, grams: 120 },
    ],
    reviews: [
      { author: "Karthik S.", country: "Australia", rating: 5, title: "Cloned our fleet onto these", body: "Twenty drives, no failures, and the boot time difference on older machines is dramatic. Good value at this price.", verified: true },
    ],
  },
  {
    slug: "seagate-ironwolf-pro-nas-drive",
    name: "Seagate IronWolf Pro NAS Drive",
    kind: "PHYSICAL",
    brand: "Seagate",
    category: "storage",
    summary: "7200 rpm NAS drive rated for 24x7 operation, with data recovery included.",
    bullets: [
      "Built for 24x7 multi-bay NAS operation",
      "550 TB/year workload rating",
      "1.2 million hours MTBF",
      "3 years of Seagate Rescue data recovery included",
    ],
    specs: {
      Capacity: "Available 4 TB to 20 TB",
      Speed: "7200 rpm",
      Interface: "SATA 6 Gb/s",
      Workload: "550 TB/year",
      Warranty: "5 years + 3 years Rescue",
    },
    hsCode: "8471.70",
    origin: "Thailand",
    glyph: "ssd",
    variants: [
      { sku: "SEA-IWP-8TB", name: "8 TB", list: D(309), price: D(249), stock: 11, leadDays: 2, grams: 900 },
      { sku: "SEA-IWP-16TB", name: "16 TB", list: D(539), price: D(429), stock: 3, leadDays: 4, grams: 900 },
    ],
  },
  {
    slug: "apc-smart-ups-1500va",
    name: "APC Smart-UPS 1500VA Line Interactive",
    kind: "PHYSICAL",
    brand: "APC",
    category: "storage",
    summary: "1500VA / 1000W line-interactive UPS with AVR and a network management slot.",
    bullets: [
      "1500 VA / 1000 W, pure sine wave output",
      "Automatic voltage regulation without draining the battery",
      "LCD status panel and hot-swappable batteries",
      "SmartSlot for network management",
    ],
    specs: {
      Capacity: "1500 VA / 1000 W",
      Topology: "Line interactive with AVR",
      Output: "Pure sine wave",
      Runtime: "~7 minutes at full load",
      Warranty: "3 years (2 years on battery)",
    },
    hsCode: "8504.40",
    origin: "India",
    glyph: "ups",
    variants: [
      { sku: "APC-SMT1500", name: "1500 VA tower", list: D(629), price: D(499), stock: 8, leadDays: 3, grams: 24500 },
    ],
    reviews: [
      { author: "Ganesh R.", country: "Kenya", rating: 5, title: "Rock solid through a bad rainy season", body: "We lost mains eleven times in one week and the server never blinked. The management card is worth adding.", verified: true },
    ],
  },
  {
    slug: "logitech-mx-keys-combo-for-business",
    name: "Logitech MX Keys Combo for Business",
    kind: "PHYSICAL",
    brand: "Logitech",
    category: "storage",
    summary: "Keyboard and mouse set that pairs to three machines and charges over USB-C.",
    bullets: [
      "Switches between three devices with one key",
      "Backlit keys with proximity sensing",
      "USB-C rechargeable — up to 10 days with backlight, 5 months without",
      "Logi Bolt secure receiver, FIPS-compliant",
    ],
    specs: {
      Connectivity: "Logi Bolt USB receiver or Bluetooth",
      Battery: "USB-C rechargeable",
      Devices: "Up to 3, switchable",
      Warranty: "1 year",
    },
    hsCode: "8471.60",
    origin: "China",
    glyph: "keyboard",
    variants: [
      { sku: "LOG-MXKEYS-COMBO", name: "Keyboard + mouse", list: D(229), price: D(179), stock: 26, leadDays: 1, grams: 1600 },
    ],
  },
  {
    slug: "microsoft-365-business-standard",
    name: "Microsoft 365 Business Standard",
    kind: "LICENCE",
    brand: "Microsoft",
    category: "software",
    summary:
      "Desktop Office apps, 1 TB of OneDrive and business email per user, on an annual commitment.",
    bullets: [
      "Word, Excel, PowerPoint and Outlook installed on up to 5 devices per user",
      "Business email on your own domain with a 50 GB mailbox",
      "1 TB of OneDrive storage per user",
      "Teams, SharePoint and Microsoft Bookings",
      "Licence keys are issued to your email the moment payment clears",
    ],
    specs: {
      "Licence type": "Annual subscription, per user",
      "Minimum term": "12 months",
      Delivery: "Electronic — issued on payment, no shipment",
      Platform: "Windows, macOS, iOS, Android, web",
      Support: "Microsoft standard support",
    },
    glyph: "licence",
    featured: true,
    variants: [
      { sku: "MS-365-BS-1U", name: "1 user, 1 year", list: D(180), price: D(149), stock: null, leadDays: null, grams: null },
      { sku: "MS-365-BS-5U", name: "5 users, 1 year", list: D(900), price: D(720), stock: null, leadDays: null, grams: null },
      { sku: "MS-365-BS-10U", name: "10 users, 1 year", list: D(1800), price: D(1400), stock: null, leadDays: null, grams: null },
    ],
    reviews: [
      { author: "Deepa L.", country: "United States", rating: 5, title: "Keys arrived in under a minute", body: "Ordered ten seats at 9pm and the keys were in my inbox before I closed the laptop. Redemption was straightforward.", verified: true },
      { author: "Ashok G.", country: "United Kingdom", rating: 4, title: "Cheaper than going direct", body: "Roughly 15% under the list price for the same thing. Renewal reminder came a month ahead, which was useful.", verified: true },
    ],
  },
  {
    slug: "adobe-creative-cloud-for-teams",
    name: "Adobe Creative Cloud for Teams — All Apps",
    kind: "LICENCE",
    brand: "Adobe",
    category: "software",
    summary: "Every Creative Cloud application, licensed per seat with an admin console.",
    bullets: [
      "All 20+ Creative Cloud desktop and mobile apps",
      "1 TB of cloud storage per seat",
      "Admin console for reassigning seats as staff change",
      "Adobe Expert Services included",
    ],
    specs: {
      "Licence type": "Annual subscription, per seat",
      "Minimum term": "12 months",
      Delivery: "Electronic — issued on payment, no shipment",
      Platform: "Windows, macOS",
    },
    glyph: "licence",
    variants: [
      { sku: "ADB-CCT-ALL-1S", name: "1 seat, 1 year", list: D(900), price: D(780), stock: null, leadDays: null, grams: null },
      { sku: "ADB-CCT-ALL-5S", name: "5 seats, 1 year", list: D(4500), price: D(3780), stock: null, leadDays: null, grams: null },
    ],
    reviews: [
      { author: "Studio Lead", country: "Germany", rating: 4, title: "Seat reassignment is the win", body: "Being able to move a seat when someone leaves has saved us buying spares. Invoicing was clean for our accounts team.", verified: true },
    ],
  },
  {
    slug: "veeam-data-platform-essentials",
    name: "Veeam Data Platform Essentials",
    kind: "LICENCE",
    brand: "Veeam",
    category: "software",
    summary:
      "Backup, recovery and ransomware protection for small estates, licensed per socket bundle.",
    bullets: [
      "Backup and instant recovery for VMware, Hyper-V, physical and cloud",
      "Immutable backup copies against ransomware",
      "5-instance bundle, expandable",
      "Includes one year of production support",
    ],
    specs: {
      "Licence type": "Annual subscription",
      Delivery: "Electronic — licence file issued on payment",
      Platform: "VMware vSphere, Microsoft Hyper-V, AHV, physical",
      Support: "24/7 production support included",
    },
    glyph: "licence",
    featured: true,
    variants: [
      { sku: "VEEAM-DPE-5I", name: "5 instances, 1 year", list: D(1450), price: D(1195), stock: null, leadDays: null, grams: null },
    ],
    reviews: [
      { author: "Mahesh A.", country: "United Arab Emirates", rating: 5, title: "Standard purchase, no surprises", body: "Licence file came through immediately and applied first time. This is our third renewal from them.", verified: true },
      { author: "Rupal S.", country: "South Africa", rating: 3, title: "Fine, but read what support covers", body: "The licence is exactly as described. Just be aware the first year of support is included and renewal is extra — that was not obvious to me.", verified: true },
    ],
  },
  {
    slug: "autodesk-autocad-subscription",
    name: "Autodesk AutoCAD — Single User Subscription",
    kind: "LICENCE",
    brand: "Autodesk",
    category: "software",
    summary: "Full AutoCAD with the industry toolsets, licensed to one named user per year.",
    bullets: [
      "AutoCAD on Windows and macOS, plus web and mobile",
      "Seven industry-specific toolsets included",
      "Named-user licensing, reassignable",
      "Autodesk technical support included",
    ],
    specs: {
      "Licence type": "Annual subscription, named user",
      Delivery: "Electronic — assigned on payment, no shipment",
      Platform: "Windows, macOS, web, mobile",
    },
    glyph: "licence",
    variants: [
      { sku: "ADSK-ACAD-1Y", name: "1 user, 1 year", list: D(2555), price: D(2190), stock: null, leadDays: null, grams: null },
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
  for (const name of BRANDS) {
    const row = await prisma.brand.create({
      data: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
    });
    brands.set(name, row.id);
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
        kind: product.kind,
        brandId,
        categoryId,
        summary: product.summary,
        bullets: product.bullets,
        specs: product.specs,
        // A licence crosses no border, so it carries neither an HS code nor a
        // country of origin — the columns stay null rather than being filled
        // with a value that would be wrong on a customs form.
        hsCode: product.kind === "LICENCE" ? null : (product.hsCode ?? null),
        origin: product.kind === "LICENCE" ? null : (product.origin ?? null),
        glyph: product.glyph,
        featured: product.featured ?? false,
        variants: {
          create: product.variants.map((variant) => ({
            sku: variant.sku,
            name: variant.name,
            listPriceMinor: variant.list,
            priceMinor: variant.price,
            stockOnHand:
              product.kind === "LICENCE" ? null : (variant.stock ?? 0),
            leadDays: product.kind === "LICENCE" ? null : (variant.leadDays ?? 3),
            weightGrams:
              product.kind === "LICENCE" ? null : (variant.grams ?? null),
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
