# Vertex Infosolutions storefront — container image for Azure App Service.
#
# Three stages, so the thing that ships carries no compiler, no source and no
# dev dependencies. The final image is the Next.js standalone server plus the
# Prisma engine and the migration files, and nothing else.

# --- deps: install once, cached on the lockfile alone ----------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Prisma's postinstall needs the schema present, and OpenSSL is a runtime
# dependency of the query engine on Debian slim.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./

# `npm ci` runs the postinstall that generates the Prisma client.
RUN npm ci


# --- builder: compile the app ----------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The build imports the generated client, so regenerate against the schema that
# was just copied in rather than trusting the layer cache.
RUN npx prisma generate

# `next build` reads DATABASE_URL only if a page queries at build time. Every
# route here is dynamic, so no database is needed to build — which is what lets
# CI build the image without a network path to Postgres.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# --- runner: what actually ships -------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# The standalone output already contains the pruned node_modules it needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migrations and the Prisma CLI travel with the image so a release can run
# `prisma migrate deploy` against the production database from this same
# artifact, rather than from somebody's laptop.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma7.config.ts ./prisma7.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

USER nextjs

# App Service probes the port it sets in WEBSITES_PORT; 8080 is the convention
# for a Linux container and matches the Bicep in infra/.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
