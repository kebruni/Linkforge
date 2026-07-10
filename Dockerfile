###############################################################################
# Linkforge — multi-stage production image (Next.js + BullMQ worker)
#
#   docker build -t linkforge .
#   docker run -p 3000:3000 --env-file .env.production linkforge
#
# Worker (same image, different command):
#   docker run --env-file .env.production linkforge node dist/worker/index.js
###############################################################################

# ---- base -------------------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# ---- deps -------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder ----------------------------------------------------------------
FROM base AS builder
RUN apk add --no-cache python3 make g++
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders so `env.ts` / Next can evaluate at compile time.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV REDIS_URL=redis://127.0.0.1:6379
ENV AUTH_SECRET=build-time-secret-min-16chars
ENV AUTH_TRUST_HOST=true
ENV APP_URL=http://localhost:3000
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN pnpm prisma generate
RUN pnpm build

# ---- runner -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache tini openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Full install from builder: Next server, Prisma CLI (migrate), worker deps.
# Standalone alone is too thin for prisma migrate + BullMQ worker on one image.
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
