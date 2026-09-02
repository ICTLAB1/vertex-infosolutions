# Vertex Infosolutions — storefront

A direct-to-customer store selling Microsoft, Adobe and Autodesk software
licences. Customer accounts, Stripe checkout, licence keys delivered into the
account, prices in INR for visitors in India and USD for everyone else. Runs on
Azure.

```bash
npm install
cp .env.example .env          # then fill in the company details
docker compose up -d db       # Postgres 16 on :5432
npm run db:migrate            # applies migrations
npm run db:seed               # sample catalogue: 34 products, 52 SKUs, both currencies
npm run dev                   # http://localhost:3000
```

## How a purchase works

1. **Create an account.** There is no guest checkout — licence keys are
   delivered into an account, so there has to be one.
2. **Confirm the email by one-time code.** Six digits, ten minutes, five
   attempts, stored hashed. Nothing can be bought until it is confirmed,
   because an unverified address is one the keys would be lost to.
3. **Pay on Stripe's own page.** No card field exists in this repository.
4. **Keys are issued once**, by whichever of the browser return and the
   webhook arrives first, and appear in the account immediately.
5. **Email always, WhatsApp if opted in.** Email carries the keys and the
   invoice. WhatsApp carries the order confirmation and never a key.

## The two things worth understanding first

### 1. Two markets, two prices — not one price converted

A visitor in India sees INR; everyone else sees USD. Those are separate rows in
the `Price` table, entered deliberately, because:

- Publishers price India differently. Microsoft 365 Business Standard is not
  the US price at spot rate, and pretending otherwise misprices the catalogue.
- An FX-derived price looks wrong (₹12,347.83) and, worse, moves between the
  moment it is displayed and the moment it is charged.

Market is resolved once, in `src/lib/market.ts`, from an explicit choice, then a
geo header, then `Accept-Language`, then a USD default. An explicit choice
always wins: somebody in London buying for an Indian office knows their own
situation better than an IP lookup does.

Once the basket holds something, **the market is locked** to it. A total that
changes between the cart and the payment page — because a geo lookup flapped —
is how a sale is lost.

### 2. The two markets are taxed completely differently

This is not a currency toggle. It is two tax regimes.

| | India (INR) | Everywhere else (USD) |
|---|---|---|
| Supply | Domestic supply of services | Export of services |
| GST | 18%, **included** in the displayed price | Zero-rated, none charged |
| Invoice | Tax invoice: taxable value, GST, SAC code | Commercial invoice |
| Buyer's GSTIN | Collected, printed, claimable as input credit | Not applicable |
| Payment | UPI, card, net banking, transfer | Card, PayPal, transfer |

The billing country decides which applies, and **the currency and the billing
country must agree** — the checkout refuses an INR basket billed to Germany
rather than charging GST on an export.

On an INR order `netMinor + taxMinor = totalMinor` exactly: the tax is split
back out of the inclusive price, and the net is derived by subtraction so the
parts always reconcile.

`Fulfilment` survives from the version of this store that also sold hardware.
Every order now has exactly one, of kind `DIGITAL`. It is kept because it costs
one join and it is the seam where physical goods would go back in.

### 3. Fulfilment happens exactly once, and is called more than once

Stripe reports a completed payment twice — the browser returning from Checkout,
and the webhook — in no guaranteed order, either of which can be lost or
replayed. Two runs would mean two sets of keys against one payment.

So `fulfilOrder` claims the order with a single conditional update
(`PENDING → PAID`) and lets the row count decide. The database serialises the
callers; whichever loses gets zero rows and returns. No lock, no queue, no
window. This is verified in the test suite by replaying the same signed webhook
event and asserting the keys are unchanged.

## Layout

```
prisma/schema.prisma     the data model, commented
prisma/seed.ts           sample catalogue — replace before launch
src/lib/auth.ts          passwords (scrypt), sessions, one-time codes
src/lib/notify.ts        the outbox: email and WhatsApp, composed and recorded
src/lib/orders.ts        fulfilOrder — the once-only claim
src/lib/renewals.ts      licence expiry dates, and the reminder sweep
src/lib/stripe.ts        client, and the simulated-payment guard
src/lib/market.ts        market resolution, restricted countries, GSTIN shape
src/lib/money.ts         integer minor units, per currency; inclusive-tax split
src/lib/cart.ts          basket, and the one function that computes what is owed
src/lib/site.ts          who the seller legally is; warns when unconfigured
src/app/actions.ts       add to cart, switch market, place an order
infra/main.bicep         the whole Azure estate
```

## Rules the code keeps

- **Money is integer minor units, per currency.** Paise for INR, cents for USD.
  Every money function takes its currency explicitly — there is no ambient
  "current currency", because the same process serves an Indian visitor and an
  American one in adjacent requests.
- **Prices come from the database, every time.** A form says what the customer
  wants, never what it costs.
- **Card details never reach this application.** There is no card field
  anywhere in this repository, and that is deliberate.
- **Export control is checked before anything else** about the billing country,
  and before the known-country test. A licence key is an export even though it
  travels by email.
- **A variant with no price in the visitor's currency is not sold to them** —
  not shown, not addable, not checkout-able. Silence beats a blank price.
- **No dark patterns.** No fake countdowns, no pre-ticked boxes, no charge
  introduced after the total is shown. WhatsApp is opt-in, unticked.
- **Secrets are hashed at rest.** Passwords with scrypt, session tokens and
  one-time codes with SHA-256. A leaked backup is not a set of live logins.
- **An order page is scoped to its owner.** The query filters on `userId` as
  well as the order number, so guessing a number gets a 404 rather than
  somebody else's keys.
- **Licence keys never go over WhatsApp.** A key forwarded in a chat is
  somebody else's licence.
- **Nothing renews itself, and nothing expires unannounced.** There is no card
  on file to charge. The expiry date is written onto the order line at
  fulfilment — not derived on read — so a licence sold under an older term keeps
  the dates it was actually sold under, and the reminder a month ahead is
  claimed with a conditional update so it goes exactly once.

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
- [ ] Replace `prisma/seed.ts` with the real price book — **both currencies**.
      A variant missing an INR row silently disappears from the Indian store.
- [ ] Wire a real geo-IP source and set `GEO_COUNTRY_HEADER`. Without one the
      store falls back to `Accept-Language`, and an Indian visitor whose browser
      reports `en-US` will be shown dollars.
- [ ] Have a lawyer review the policy pages. They describe what the code does
      and are drafts.
- [ ] **Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.** Without the
      first, checkout refuses in production and simulates in development;
      without the second the webhook returns 503 and no order ever completes.
      Register the endpoint at `POST /api/webhooks/stripe` for
      `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
      `checkout.session.async_payment_failed`, `checkout.session.expired` and
      `charge.refunded`.
- [ ] **Set `RESEND_API_KEY` and `EMAIL_FROM`.** Without them the one-time code
      is never delivered and nobody can verify an account, which means nobody
      can buy anything. Authenticate the sending domain (SPF, DKIM, DMARC) or
      the codes land in spam.
- [ ] **Get the three WhatsApp templates approved by Meta** before enabling
      WhatsApp — business-initiated messages must use a pre-approved template,
      and sending an unapproved one just fails.
- [ ] **Set `CRON_SECRET` and schedule the renewal sweep.** Five pages promise
      a reminder a month before a subscription expires; `POST /api/cron/renewals`
      is what sends it, and nothing calls it on its own. A Logic App recurrence,
      a Container Apps job or any daily `curl` with the secret in the
      `x-vertex-cron-key` header will do. Without the schedule the promise is
      copy, not behaviour.
- [ ] Add a retry sweep over `Notification` rows left `FAILED`. They are
      recorded, but nothing currently retries them.
- [ ] Add password reset. There is no "forgot password" flow yet — the OTP
      machinery is there for it (`OtpPurpose.SIGN_IN`) but unwired.
- [ ] Rate-limit sign-in by IP as well as by account.
- [ ] **Confirm the GST treatment with your accountant.** The store charges
      18% GST on Indian sales and treats everything else as a zero-rated export
      of services — which requires an LUT, or paying IGST and claiming a refund.
      The SAC used is 997331.
- [ ] **Decide the destination-tax position for digital sales abroad.** Selling
      software to EU consumers triggers EU VAT (OSS) obligations regardless of
      value; the UK, Australia, Singapore and others have equivalent rules for
      supplies of digital services. `Order.taxMinor` and `taxRatePercent` are
      already on the order for the day you collect it. Get advice before taking
      consumer orders from those markets.
- [ ] **Confirm reseller authorisation** with Microsoft, Adobe and Autodesk.
      The store describes itself as an authorised reseller on several pages.
- [ ] Review the restricted-country list in `src/lib/market.ts` against current
      sanctions, and against the store's obligations as an Indian exporter. The
      list in the code is a floor, not a compliance programme.
- [ ] Replace the GSTIN shape check with a real GST portal lookup.
- [ ] Send a lapse notice on the day itself. The sweep deliberately says
      nothing about a licence that has already expired — "expires in -3 days"
      is worse than silence — so a licence that slipped past while the schedule
      was down is visible in the account and nowhere else.
- [ ] Attach the invoice PDF to the confirmation email — the GST invoice for
      India, the commercial invoice elsewhere. The email refers to it; nothing
      generates it yet.
- [ ] Automate seat assignment with the publishers' partner APIs. Keys are
      currently generated locally as placeholders, not redeemed from
      Microsoft, Adobe or Autodesk.
- [ ] Move `DATABASE_URL` into Key Vault; put Postgres behind a private endpoint.
- [ ] Replace the placeholder drawings with publisher product imagery, and
      check the brand-usage rules that come with reseller authorisation.

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
dropdown, the currency switch, the auth forms and the checkout form. Payments
by Stripe Checkout; email by Resend; WhatsApp by the Meta Cloud API.
