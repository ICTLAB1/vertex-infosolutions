# Vertex Infosolutions — storefront

A direct-to-customer store for IT hardware and software licences. Browse, add to
a basket, pay, and track what happens next.

```bash
npm install
cp .env.example .env      # then fill in the company details
npm run db:migrate        # creates dev.db and applies migrations
npm run db:seed           # sample catalogue: 18 products, 27 SKUs, 21 reviews
npm run dev               # http://localhost:3000
```

## The thing worth understanding first

A basket here can hold a monitor **and** a licence key. Those are one payment
with two different afterlives:

| | Monitor | Licence |
|---|---|---|
| Needs an address | yes | no |
| Comes off stock | yes | no |
| Delivery charge | yes | no |
| Arrives | in a few days, by courier | in seconds, by email |
| Returnable | 7 days | not once the key is revealed |

So `Order` is the **money** object — one total, one GST computation, one
payment — and `Fulfilment` sits beneath it carrying **status**. One order gets
at most two: a `SHIPMENT` and a `DIGITAL`. An order can be delivered by email
and still in transit by road, and neither fact contradicts the other.

Everything else follows from that. Delivery is charged on the shipped subset
only. Cash on delivery is refused on any basket containing a licence, because
there is nothing for a courier to hand over. Returnability is a property of the
line, not the order.

If you change one thing in this codebase, do not collapse status back onto
`Order`. It is the first thing that looks like a simplification and the first
thing that breaks.

## Layout

```
prisma/schema.prisma     the data model, commented
prisma/seed.ts           sample catalogue — replace before launch
src/lib/cart.ts          basket, and the one function that computes what is owed
src/lib/delivery.ts      serviceable pincodes, delivery dates, shipping charges
src/lib/money.ts         integer paise; a rupee is never a float
src/lib/site.ts          who the seller legally is; warns when unconfigured
src/app/actions.ts       add to cart, change quantity, place an order
```

## Rules the code keeps

- **Money is integer paise.** A rupee value exists only as a string on its way
  to a screen.
- **Prices come from the database, every time.** A form says what the customer
  wants, never what it costs.
- **Stock is committed when the order is placed**, not when it ships — the gap
  between the two is where overselling happens.
- **Card details never reach this application.** Payment is taken on the
  gateway's own page. There is no card field anywhere in this repository, and
  that is deliberate.
- **No dark patterns.** No fake countdowns, no pre-ticked boxes, no charge
  introduced after the total is shown.

## Before this takes a real order

- [ ] Fill in every field in `.env` — the footer and `/grievance` render only
      what is configured, and development shows a banner listing what is missing.
- [ ] Replace `prisma/seed.ts` with the real catalogue.
- [ ] Have the policy pages (`/terms`, `/privacy`, `/returns`, `/delivery`)
      reviewed by a lawyer. They describe what the code does and are drafts.
- [ ] Wire a real payment gateway. `placeOrder` currently marks non-COD orders
      paid immediately; a real integration leaves them `PENDING` and lets the
      gateway's webhook move them, with capture idempotent because the browser
      and the webhook both report success in no guaranteed order.
- [ ] Move off SQLite. Change the `datasource` provider and the adapter in
      `src/lib/db.ts` together.
- [ ] Gate `/order/[number]` behind a signed link or an account. Today the order
      number alone reaches it, which is fine for a demo and not for production.
- [ ] Send the confirmation email and the tax invoice. Neither is implemented.
- [ ] Replace the placeholder product drawings with photography.

## Scripts

| | |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | create and apply a migration |
| `npm run db:seed` | reset and reseed the catalogue |
| `npm run db:reset` | drop, re-migrate, reseed |

## Stack

Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, Prisma 7 with a
better-sqlite3 driver adapter. Server components and server actions throughout;
the only client components are the quantity dropdown and the checkout form.
