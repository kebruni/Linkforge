# Linkforge

Production-grade open SaaS platform for link-in-bio / mini-landing pages, in
the spirit of Linktree, Taplink, Beacons and Bento.me — built on Next.js 15,
Prisma, PostgreSQL, Redis and BullMQ.

> **Status:** v1.1.1 production product. Auth (OAuth, password reset, email verify,
> TOTP 2FA, device sessions), freemium plan limits, page builder, public renderer,
> analytics (UTM / geo / devices), AI co-pilot, Stripe billing (PRO + coupons +
> donations/products), short links, API keys, webhooks, custom domains, admin
> moderation + coupons, QR, form leads, theme editor, security hardening, and
> full deploy stack. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) and
> [`DEPLOYMENT.md`](./DEPLOYMENT.md).

```bash
pnpm e2e:smoke          # API smoke against running app
pnpm security:audit     # optional stress/security harness
```

## Quick links

- [Architecture & roadmap](./ARCHITECTURE.md)
- [Deployment guide](./DEPLOYMENT.md)
- [Environment variables reference](./.env.example)

## Tech stack

| Layer       | Technology                                                                 |
| ----------- | -------------------------------------------------------------------------- |
| Frontend    | Next.js 15 (App Router, RSC), React 19, TypeScript, Tailwind, shadcn/ui    |
| State       | Zustand (client UI), TanStack Query (server cache), React Hook Form + Zod  |
| Animation   | Framer Motion                                                              |
| Backend     | Next.js Route Handlers + Server Actions, BullMQ workers (`apps/worker`)    |
| Database    | PostgreSQL 16 + Prisma 5                                                   |
| Cache/queue | Redis 7 + BullMQ                                                           |
| Auth        | Auth.js (NextAuth v5), OAuth (Google / GitHub), email magic-link, TOTP 2FA |
| Storage     | S3-compatible (Cloudflare R2 / MinIO)                                      |
| Payments    | Stripe (subscriptions + one-shot digital goods)                            |
| Edge/proxy  | Nginx (HTTP/2, gzip, brotli, rate-limit, security headers)                 |
| TLS         | Let's Encrypt via certbot (auto-renew)                                     |
| CI/CD       | GitHub Actions (lint → typecheck → test → build → deploy via SSH)          |
| Monitoring  | Health endpoint, structured pino logs, optional Prometheus/Grafana stack   |

## Local development

```bash
# 1. Install deps
pnpm install

# 2. Boot Postgres + Redis
# Postgres is published on host :5433 (avoids clashing with a local :5432).
docker compose -f docker-compose.dev.yml up -d

# 3. Configure env
cp .env.example .env
# Set DATABASE_URL to ...@localhost:5433/linkforge?... if using compose defaults.
# Also set AUTH_SECRET (openssl rand -base64 32). OAuth keys optional.

# 4. Apply schema + seed
pnpm prisma migrate dev
pnpm prisma db seed

# 5. Run web + worker
pnpm dev
# in another terminal:
pnpm worker
```

App will be at <http://localhost:3000>. The public renderer is at
`/u/<slug>`; the dashboard is at `/dashboard`.

## Production

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full Ubuntu 24.04 + Docker +
Nginx + Let's Encrypt walkthrough targeting `linkforge.kebruni.me`.

```bash
# On the VPS (canonical path /srv/linkforge):
cp .env.example .env.production   # fill POSTGRES_PASSWORD, DATABASE_URL, AUTH_SECRET, APP_URL
EMAIL=admin@kebruni.me bash scripts/ssl-init.sh
bash scripts/deploy.sh
```

## License

MIT
