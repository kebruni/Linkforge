# Linkforge — Project context for future agents (handover doc)

> **For other AIs / engineers picking this up:** this is the single source of truth
> for **what was asked, what's done, what's in progress, and what's next**. Read
> this top-to-bottom before doing anything. Then read `ARCHITECTURE.md` (system
> design) and `DEPLOYMENT.md` (VPS guide).

Last updated: **2026-07-10** (v1.0 production feature pass).

---

## 0. TL;DR

- Goal: build **production-grade Linktree/Taplink/Beacons clone** branded as
  **Linkforge**, deployed at `https://linkforge.kebruni.me`
  (VPS `164.92.240.90`, SSH `:2222`, deploy user `nurbek`).
- Status: **v1.0 product complete** (auth hardening, billing, short links, admin
  actions, real email/webhook workers). Docker/image/compose ready.
  **Live VPS cutover still needs SSH key + first `setup-vps` / `ssl-init` / `deploy`.**

---

## 1. Original requirements (verbatim summary of the user prompt)

The user (`@kebruni`, name "Nurbek") asked for the following 20 sections —
verbatim section titles preserved so future agents can map work to original
asks:

1. **Auth system** — register/login/recover/OAuth/remember-me/refresh tokens/
   anti-brute-force/device sessions/suspicious-login detection.
2. **User dashboard** — stats, views, CTR, charts, link management, drag-and-
   drop editor, live preview, dark/light.
3. **Page builder** — drag & drop blocks, reorder, animations, live edit,
   responsive preview, grid, templates, custom CSS, markdown.
   Block library: links, text, buttons, video, YouTube, TikTok, Telegram,
   Spotify, forms, FAQ, countdown, gallery, testimonials, products,
   donations, maps, contact forms.
4. **Design system** — glass/neumorphism, gradients, animations, premium type,
   adaptive, accessible. Themes, custom fonts, background videos, particles,
   animated backgrounds.
5. **Analytics** — clicks, views, unique visitors, GEO, devices, OS/browser,
   heatmaps, UTM, conversion, realtime dashboard. Recharts/ApexCharts.
6. **AI features** — bio generator, theme generator, color palette, landing
   optimizer, SEO assistant, CTA suggestions, content rewrite, username
   suggestions.
7. **Monetization** — Stripe, PayPal, subscriptions, PRO tiers, freemium,
   coupons, affiliate, referral, digital product sales.
8. **SEO + perf** — SSR/SSG, metadata, sitemap, robots, OG, Twitter cards,
   schema.org, lazy-loading, image opt, edge caching. **Lighthouse 95+.**
9. **Security** — rate-limiting, CSRF/XSS/CSP, SQLi prevention, audit logs,
   IP tracking, anti-spam, captcha, secure cookies, RBAC.
10. **Admin panel** — users, bans, stats, complaints, moderation, payments,
    subscriptions, analytics, logs, feature flags.
11. **Database** — Prisma schema with relations, indexes, migrations, soft
    delete, audit fields, scalable.
12. **API** — REST, versioning, Swagger, rate limits, typed responses,
    validation, pagination, filtering, caching.
13. **File structure** — monorepo, feature-based, scalable.
14. **UI/UX** — Apple/Notion/Stripe/Linear/Vercel quality.
15. **Landing page** — hero, animations, testimonials, pricing, FAQ,
    integrations, CTAs, modern marketing sections.
16. **Extra features** — QR generator, short links, custom domains, webhooks,
    API keys, integrations, Telegram bot, email notifications, push
    notifications, scheduled posts, A/B testing, themes marketplace.
17. **Production requirements** — env config, Docker, deploy guide, CI/CD,
    testing, linting, formatting, monitoring, logging, error handling.
18. **Testing** — unit/integration/e2e, Playwright, Jest.
19. **Performance** — caching, Redis, query opt, code splitting, dynamic
    imports, edge rendering, image CDN.
20. **Deployment** — Ubuntu 24.04, Docker, Docker Compose, Nginx, SSL,
    Let's Encrypt, PM2 (if needed), Fail2ban, UFW, GitHub Actions CI/CD.
    Real VPS: `linkforge.kebruni.me`, IP `164.92.240.90`, SSH port `2222`,
    deploy user `nurbek` (also has `root`).

---

## 2. Decisions & operating notes

| Decision                                                                  | Why                                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Phased delivery**                                                       | The full ask is 6–12 months of team work; ship solid core + monetization.    |
| **Domain: `linkforge.kebruni.me`**                                        | User correction (was originally `together.kebruni.me`).                      |
| **Repo: `kebruni/Linkforge`**                                             | User asked for the code in their own repo.                                   |
| **Auth split:** `src/auth.config.ts` (edge) + `src/auth.ts` (Node)        | argon2 is native and can't run in the edge runtime used by `middleware.ts`.  |
| **`serverExternalPackages` in `next.config.ts`**                          | Argon2/bullmq/ioredis/Prisma/pino can't be bundled into edge/RSC.            |
| **System fonts (no Google Fonts at build)**                               | Offline / firewalled builds fail on `next/font/google`; use CSS stacks.      |
| **Dev Postgres on host `:5433`**                                          | Host often already has Postgres on `:5432`.                                  |
| **Stripe optional at boot**                                               | `FEATURE_BILLING` + keys; UI degrades with clear messages when off.          |
| **AI works without API key**                                              | Deterministic offline fallbacks; OpenAI when `OPENAI_API_KEY` set.           |
| **Email without SMTP**                                                    | Worker logs the job; with SMTP it delivers via nodemailer.                   |

### 2a. Security caveats currently outstanding

- Historical note: PATs may have been shared in chat earlier. Rotate if still
  active: <https://github.com/settings/tokens>.
- Seed creates `admin@linkforge.local` / `password123` — **dev only**, never
  use in production.

---

## 3. Status by section (✅ done / 🟡 partial / ⏳ todo)

### Shipped in v1.0

| #   | Section                | Status | Where                                                                                |
| --- | ---------------------- | ------ | ------------------------------------------------------------------------------------ |
| 1   | Auth                   | ✅     | credentials + OAuth, rate-limit, password reset, email verify, TOTP 2FA step-up      |
| 2   | Dashboard              | ✅     | overview, pages, analytics, leads, short links, settings, AI                         |
| 3   | Page builder           | ✅     | dnd, all palette blocks, inspectors, theme editor, live preview, QR                  |
| 4   | Design system (basic)  | ✅     | Tailwind + shadcn tokens, dark/light, public theme tokens                            |
| 5   | Analytics              | ✅     | track API + worker rollup + Recharts dashboard                                       |
| 6   | AI (basic)             | ✅     | `/api/ai/generate` + studio UI, fallbacks + OpenAI                                   |
| 7   | Monetization           | ✅     | Stripe Checkout (PRO sub), portal, webhooks, donation/product one-time checkout      |
| 8   | SEO                    | ✅     | metadata helpers, JSON-LD, `sitemap.ts`, `robots.ts`                                 |
| 9   | Security (core)        | ✅     | rate-limit, nginx headers, middleware RBAC, 2FA, audit log writes                    |
| 10  | Admin                  | ✅     | overview, users (promote/suspend), feature flags                                     |
| 11  | Database               | ✅     | full Prisma schema + `prisma/migrations/`                                            |
| 12  | API (REST)             | ✅     | pages/blocks/theme/qr/me/forms/ai/analytics/billing/short-links/auth/admin           |
| 13  | File structure         | ✅     | feature-based under `src/`                                                           |
| 14  | UI/UX                  | ✅     | marketing + dashboard polish                                                         |
| 15  | Landing page           | ✅     | `src/app/(marketing)/page.tsx`                                                       |
| 16  | QR + forms + shorts    | ✅     | QR PNG; form leads; short-link CRUD + redirect                                       |
| 17  | Production reqs        | ✅     | Docker, compose, nginx, CI/CD, scripts, email worker, webhook delivery               |
| 18  | Testing (unit)         | ✅     | Vitest: utils + block schemas (`pnpm test`)                                          |
| 19  | Performance (basic)    | ✅     | Redis, standalone Next build, App Router splitting                                   |
| 20  | Deployment docs        | ✅     | `DEPLOYMENT.md` + scripts (first live deploy still pending)                          |

### Deferred (post-v1.0)

| #   | Section                | Status | Notes                                                                                  |
| --- | ---------------------- | ------ | -------------------------------------------------------------------------------------- |
| 1   | Auth extras            | ⏳     | Device sessions list UI, suspicious-login email, OAuth Telegram.                       |
| 5   | Analytics (full)       | ⏳     | UTM parsing UI, conversion funnels, realtime websocket.                                |
| 7   | PayPal / coupons UI    | ⏳     | Coupon table exists; no admin coupon UI yet.                                           |
| 9   | Captcha                | ⏳     | Turnstile/hCaptcha on public forms.                                                    |
| 10  | Admin reports queue   | ⏳     | ContentReport model ready; moderation UI shallow.                                      |
| 16  | Custom domains / bot   | ⏳     | ACME + nginx dynamic vhosts, Telegram bot, webhooks UI, A/B, marketplace.              |
| 18  | Testing (e2e)          | ⏳     | Playwright e2e.                                                                        |
| —   | Monitoring stack       | ⏳     | Grafana + Prometheus + Loki.                                                           |

---

## 4. Roadmap

### v1.1

1. **Custom domains** — DNS verify + ACME + nginx dynamic vhosts.
2. **Playwright e2e** — register → create page → publish → public visit → track.
3. **Device sessions UI** + login history.
4. **First VPS deploy** — `setup-vps.sh` → `ssl-init.sh` → `deploy.sh`.

### v1.2+

See `ARCHITECTURE.md` §16 (AI optimiser, themes marketplace, k8s, etc.).

---

## 5. Infra reference

### VPS
- IP: `164.92.240.90`
- SSH: port `2222`, user `nurbek`
- Bootstrap: `scripts/setup-vps.sh`
- TLS: `scripts/ssl-init.sh`
- Deploy: `scripts/deploy.sh`

### Domains
- Primary: `linkforge.kebruni.me` → `164.92.240.90`

### Local dev notes
- Postgres via compose: **host port 5433** → container 5432.
- Demo admin after seed: `admin@linkforge.local` / `password123`
- Gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

### Enable billing in prod
```bash
FEATURE_BILLING=true
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```
Webhook endpoint: `POST /api/billing/webhook`

### Tech stack pin
- Node `>=20.10.0`, pnpm `9.12.3`
- Next.js `15.1.3`, React `19.0.0`, TypeScript `5.7.2`
- Prisma `5.22.0`, Postgres 16, Redis 7, Auth.js `5.0.0-beta.25`
- Stripe SDK, nodemailer (SMTP), otplib (TOTP)

---

## 6. How to continue

1. Read this file → `ARCHITECTURE.md` → `DEPLOYMENT.md` → `prisma/schema.prisma`.
2. Local boot:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   pnpm install
   cp .env.example .env   # AUTH_SECRET + DATABASE_URL :5433
   pnpm prisma migrate dev
   pnpm prisma db seed
   pnpm dev               # + pnpm worker
   ```
3. Pick **one** v1.1 PR; don't boil the ocean.
4. Update this file when shipping.

---

## 7. Open questions / blocked items

- **First deploy to the VPS hasn't happened from this machine** (no SSH key for
  `nurbek@164.92.240.90:2222`). On the VPS: `setup-vps.sh` → clone to
  `/srv/linkforge` → `.env.production` → `ssl-init.sh` → `deploy.sh`.
- **GitHub secrets for Actions:** `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`.
- **Default branch / push to `main`** needed for auto-deploy workflow.
- **Stripe keys** required before real checkout works.

---

## 8. Glossary

- **Block** — atomic unit of a page (link, text, form, …) in `Block` table.
- **Page** — `/u/<slug>` mini-landing.
- **Theme** — visual tokens on `Theme` (also editable in builder).
- **Worker** — `worker/index.ts` drains analytics stream / email / webhooks.
- **Edge-safe auth** — `src/auth.config.ts` for middleware.
- **Node auth** — `src/auth.ts` with Credentials + argon2.
- **2FA step-up** — JWT `twoFactorPending` until `/api/auth/2fa/verify`.
