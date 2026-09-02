# Vertex Infosolutions — storefront

A direct-to-customer store selling IT hardware and software licences to
customers outside India. Prices in USD, ships worldwide, runs on Azure.

```bash
npm install
cp .env.example .env          # then fill in the company details
docker compose up -d db       # Postgres 16 on :5432
npm run db:migrate            # applies migrations
npm run db:seed               # sample catalogue: 18 products, 27 SKUs, 21 reviews
npm run dev                   # http://localhost:3000
```

## The two things worth understanding first

### 1. A basket can hold a monitor *and* a licence key

Those are one payment with two different afterlives:

| | Monitor | Licence |
|---|---|---|
| Needs an address | yes | no |
| Comes off stock | yes | no |
| Shipping charge | yes | no |
| Crosses a border | yes — customs, duty, HS code | no |
| Arrives | days, by carrier | seconds, by email |
| Returnable | 14 days | not once the key is revealed |

So `Order` is the **money** object — one total, one payment, one currency — and
`Fulfilment` sits beneath it carrying **status**. One order gets at most two: a
`SHIPMENT` and a `DIGITAL`. An order can be delivered by email and still
clearing customs, and neither fact contradicts the other.

If you change one thing in this codebase, do not collapse status back onto
`Order`. It is the first thing that looks like a simplification and the first
thing that breaks.

### 2. The customer is in another country, and pays their own duty

Orders ship **DAP** — we charge for goods and carriage, the destination charges
import duty and tax on arrival, and the carrier collects it before delivery.
Nothing is collected at checkout, and every surface says so: the product page,
the cart, the checkout summary and the order confirmation.

`Order.taxMinor` exists and is always `0`. It is there for the day the store
registers for EU IOSS or UK VAT and starts collecting at the point of sale —
see the launch checklist.

## Layout

```
prisma/schema.prisma     the data model, commented
prisma/seed.ts           sample catalogue — replace before launch
src/lib/money.ts         integer minor units; currency is configuration
src/lib/shipping.ts      zones, rates, transit ranges, restricted destinations
src/lib/cart.ts          basket, and the one function that computes what is owed
src/lib/site.ts          who the seller legally is; warns when unconfigured
src/app/actions.ts       add to cart, change quantity, place an order
infra/main.bicep         the whole Azure estate
```

## Rules the code keeps

- **Money is integer minor units.** A price never exists as a float. The
  currency is `STORE_CURRENCY`, not a hardcoded symbol — but changing it does
  **not** convert existing prices, so reprice the catalogue in the same change.
- **Prices come from the database, every time.** A form says what the customer
  wants, never what it costs.
- **Stock is committed when the order is placed**, not when it ships. The gap
  between the two is where overselling happens.
- **Card details never reach this application.** There is no card field
  anywhere in this repository, and that is deliberate.
- **Export controls are checked before anything else** about an address. A
  restricted destination is refused for licences too — a key is an export even
  though it travels by email.
- **No dark patterns.** No fake countdowns, no pre-ticked boxes, no charge
  introduced after the total is shown.

## Deploying to Azure

Nothing here uses Netlify, Vercel or Supabase. The estate is:

| | |
|---|---|
| **App Service** (Linux, container) | runs the app |
| **Container Registry** | holds the image; the Web App pulls with a managed identity, so no registry password exists |
| **Database for PostgreSQL Flexible Server** | the database, TLS-only |
| **Application Insights + Log Analytics** | logs and traces |

### First time

```bash
az group create -n rg-vertex-prod -l centralindia
az deployment group create -g rg-vertex-prod -f infra/main.bicep \
  -p namePrefix=vertex dbAdminPassword='<a strong password>'
```

The template outputs the Web App name, its URL, and the registry login server.
Put those into the repository's GitHub **variables** as `AZURE_WEBAPP_NAME`,
`AZURE_RESOURCE_GROUP` and `AZURE_REGISTRY`.

### Continuous deployment

`.github/workflows/azure-deploy.yml` runs on every push to `main`: typecheck,
lint and build; then build the image, push it to ACR, run
`prisma migrate deploy`, point the Web App at the new tag, and poll
`/api/health` until it returns 200.

Authentication is OIDC — there is no long-lived Azure credential in the
repository. Required GitHub **secrets**: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, and `DATABASE_URL` for the migration step.

Migrations run **before** the new image goes live, so the schema is always at
least as new as the code reading it. Every migration therefore has to be
backwards compatible with the version still serving traffic: add a column
before writing to it, drop one a release later.

### Notes on the Azure setup

- `WEBSITES_PORT=8080` matches the Dockerfile's `EXPOSE`. App Service will not
  route to a container listening anywhere else.
- `healthCheckPath` is `/api/health`, which queries the database rather than
  just returning 200 — an instance that cannot reach Postgres should leave
  rotation instead of failing requests.
- `alwaysOn` is off on the B1 tier because B1 does not support it. Cold starts
  will be visible; move to P0v3 or better before launch.
- The Postgres firewall rule is `AllowAllAzureServices`, which is the loosest
  rule that works without a VNet. **Replace it with a private endpoint or VNet
  integration before launch.**
- `DATABASE_URL` is written into App Service configuration by the Bicep
  template. Move it to Key Vault with a reference before launch.

## Before this takes a real order

- [ ] Fill in every field in `.env` — the footer and `/contact` render only
      what is configured, and development shows a banner listing what is missing.
- [ ] Replace `prisma/seed.ts` with the real catalogue, with real HS codes.
      A wrong HS code is the most common reason a shipment is held at the border.
- [ ] Have a lawyer review the policy pages. They describe what the code does
      and are drafts.
- [ ] Wire a real payment gateway. `placeOrder` currently marks card and PayPal
      orders paid immediately; a real integration leaves them `PENDING` and lets
      the gateway's webhook move them, with capture idempotent because the
      browser and the webhook both report success in no guaranteed order.
- [ ] **Decide the destination-tax position.** Shipping DAP is lawful and is
      what the site says, but selling to consumers in the EU below €150 or the
      UK below £135 generally requires collecting VAT at the point of sale
      (IOSS / UK VAT registration). Digital licences sold to EU consumers are
      caught by the VAT MOSS rules regardless of value. Get advice before
      taking orders from those markets.
- [ ] Review the restricted-destination list in `src/lib/shipping.ts` against
      current sanctions, and against the store's obligations as an Indian
      exporter. The list in the code is a floor, not a compliance programme.
- [ ] Replace the flat shipping rate card with the carrier's rating API.
- [ ] Gate `/order/[number]` behind a signed link or an account. Today the
      order number alone reaches it, which is fine for a demo and not for
      production.
- [ ] Send the confirmation email and the commercial invoice. Neither is
      implemented.
- [ ] Move `DATABASE_URL` into Key Vault; put Postgres behind a private endpoint.
- [ ] Replace the placeholder product drawings with photography.

## Scripts

| | |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build (standalone output) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run db:migrate` | create and apply a migration |
| `npm run db:seed` | reset and reseed the catalogue |
| `npm run db:reset` | drop, re-migrate, reseed |

## Stack

Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, Prisma 7 on
PostgreSQL 16 via the `@prisma/adapter-pg` driver adapter. Server components
and server actions throughout; the only client components are the quantity
dropdown, the country picker and the checkout form.
