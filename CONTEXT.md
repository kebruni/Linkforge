# Linkforge — Project context for future agents (handover doc)

> **For other AIs / engineers picking this up:** this is the single source of truth
> for **what was asked, what's done, what's in progress, and what's next**. Read
> this top-to-bottom before doing anything. Then read `ARCHITECTURE.md` (system
> design) and `DEPLOYMENT.md` (VPS guide).

Last updated: **2026-05-07** by Devin session
[`ac48db3ac7474c4eb510eb8a05700442`](https://app.devin.ai/sessions/ac48db3ac7474c4eb510eb8a05700442) — Auth hardening (PR #4 of v1.1) shipped: TOTP 2FA + recovery codes + device sessions UI + suspicious-login email + audit logs.

Prior updates:
- 2026-05-07 [`56ee684822e7436680adc10ba19d12b5`](https://app.devin.ai/sessions/56ee684822e7436680adc10ba19d12b5) — MVP scaffold + domain rename + this handover doc.

---

## 0. TL;DR

- Goal: build **production-grade Linktree/Taplink/Beacons clone** branded as
  **Linkforge**, deployed at `https://linkforge.kebruni.me`
  (VPS `164.92.240.90`, SSH `:2222`, deploy user `nurbek`).
- Approach: **phased delivery** — full feature set is months of work; we ship
  MVP first, then layer in admin / billing / AI / monitoring / scale.
- Status: **MVP scaffold merged.** Everything below in §3 marked ✅ is in the
  repo. The first deploy to the VPS hasn't happened yet.

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
| **Phased delivery**                                                       | The full ask is 6–12 months of team work; MVP first, then admin/billing/AI.  |
| **Domain: `linkforge.kebruni.me`**                                        | User correction (was originally `together.kebruni.me`).                      |
| **Repo: `kebruni/Linkforge`** (was migrated from `ayna12345123123/project`) | User asked for the code in their own repo.                                   |
| **PR base = `base` branch** (not `main`)                                  | Empty repo, system blocks direct pushes to `main`. Rename `base`→`main` post-merge. |
| **Auth split:** `src/auth.config.ts` (edge) + `src/auth.ts` (Node)        | argon2 is native and can't run in the edge runtime used by `middleware.ts`.  |
| **`serverExternalPackages` in `next.config.ts`**                          | Argon2/bullmq/ioredis/Prisma/pino can't be bundled into edge/RSC.            |
| **`vitest run --passWithNoTests`**                                        | Test suite hasn't been written yet; CI shouldn't fail on empty.              |
| **No Prisma migrations committed**                                        | Schema is final; first deploy must run `prisma migrate dev --name init`.     |
| **Stripe/AI/admin/custom domains deferred**                               | Out of MVP scope — see §4 Roadmap.                                           |
| **Telegram OAuth not in MVP**                                             | Telegram login widget needs separate domain + bot; v1.1 candidate.           |

### 2a. Security caveats currently outstanding

- The user shared **two different GitHub PATs** in plaintext chat (one for
  `Linkforge-token` and one for `Linkforgev2`). User chose **not** to revoke.
  Rotate when convenient: <https://github.com/settings/tokens>.
- The PR target was set to `base` because pushing to `main` is blocked. The
  user should rename `base` → `main` in GitHub repo settings after merge.

---

## 3. Status by section (✅ done / 🟡 partial / ⏳ todo)

> Each row links to the file or directory where the work lives (for done /
> partial). For "todo" rows, future agents should read the linked design doc
> section.

### MVP slice (all in `kebruni/Linkforge#1`)

| #   | Section                | Status | Where                                                                                |
| --- | ---------------------- | ------ | ------------------------------------------------------------------------------------ |
| 1   | Auth (basic + 2FA)     | ✅     | `src/auth.config.ts`, `src/auth.ts`, `src/middleware.ts`, `src/features/auth/*`, `src/features/security/*`, `src/lib/{totp,recovery,audit,auth-sessions,email}.ts`, `src/app/api/auth/{preflight,2fa,sessions}/**` |
| 2   | Dashboard (basic)      | 🟡     | `src/app/(dashboard)/*`, `src/features/dashboard/*`                                  |
| 3   | Page builder (basic)   | 🟡     | `src/features/builder/*`, `src/components/builder/*`, `src/app/api/pages/[id]/*`    |
| 4   | Design system          | 🟡     | `tailwind.config.ts`, `src/components/ui/*`, `src/styles/*`                          |
| 5   | Analytics ingest       | 🟡     | `src/app/api/analytics/track/route.ts`, `worker/index.ts`, `prisma/schema.prisma`    |
| 8   | SEO + perf             | 🟡     | `src/lib/seo.ts`, `src/app/u/[slug]/page.tsx`, `src/app/sitemap.ts`, `next.config.ts`|
| 9   | Security (basic)       | 🟡     | `src/lib/rate-limit.ts`, `nginx/snippets/security-headers.conf`, `next.config.ts`    |
| 11  | Database               | ✅     | `prisma/schema.prisma`, `prisma/seed.ts`                                             |
| 12  | API (REST)             | 🟡     | `src/app/api/**`                                                                     |
| 13  | File structure         | ✅     | repo root (feature-based, see `src/features/*`)                                      |
| 14  | UI/UX                  | 🟡     | `src/components/*`, `src/app/(marketing)/page.tsx`                                   |
| 15  | Landing page           | ✅     | `src/app/(marketing)/page.tsx`                                                       |
| 17  | Production requirements| ✅     | `Dockerfile`, `docker-compose.{dev,prod}.yml`, `.github/workflows/*`                 |
| 18  | Testing                | 🟡     | Vitest wired (`pnpm test`); 17 unit tests for `crypto`/`recovery`/`totp`. e2e/Playwright still TODO. |
| 19  | Performance            | 🟡     | Next 15 standalone build, Redis caching, code splitting via App Router.              |
| 20  | Deployment             | ✅     | `nginx/`, `scripts/{setup-vps,ssl-init,deploy,backup-db,restore-db}.sh`, CI/CD       |

### Deferred (post-MVP, on roadmap)

| #   | Section                | Status | Notes                                                                                  |
| --- | ---------------------- | ------ | -------------------------------------------------------------------------------------- |
| 1   | Auth (Telegram OAuth)  | ⏳     | OAuth Telegram (login widget + `/api/auth/telegram/callback` HMAC verify) is the last piece left for v1.1 auth. |
| 2   | Dashboard (full)       | ⏳     | Realtime dashboard, heatmaps, conversion funnels. v1.2.                                |
| 3   | Page builder (full)    | ⏳     | TikTok/Telegram/Spotify embeds, FAQ, countdown, gallery, testimonials, products, donations, map blocks. v1.1. |
| 4   | Design system (full)   | ⏳     | Animated backgrounds, particles, custom fonts (Google Fonts loader), themes marketplace. v1.2. |
| 5   | Analytics (full)       | ⏳     | UTM parsing, conversion analytics, realtime websocket dashboard. v1.1.                 |
| 6   | AI features            | ⏳     | OpenAI-compatible API. Bio/theme/SEO/CTA/username generators. v1.2.                    |
| 7   | Monetization           | ⏳     | Stripe (sub + Checkout + webhooks), coupons, affiliate, referral. v1.1.                |
| 9   | Security (full)        | ⏳     | hCaptcha/Cloudflare Turnstile, full RBAC enforcement on every endpoint. v1.1.          |
| 10  | Admin panel            | ⏳     | Users/bans/reports/payments/feature flags UI. v1.1.                                    |
| 16  | Extra features         | ⏳     | QR generator (server route), short links UI, custom domains + ACME, Telegram bot, push notifications, A/B testing, scheduled posts. Spread across v1.1–v1.3. |
| 18  | Testing (full)         | ⏳     | Unit (Vitest), integration (DB-backed), e2e (Playwright). v1.1.                        |
| 19  | Performance (full)     | ⏳     | Edge image CDN, ISR for `/u/[slug]`, query plan review, k6 load tests. v1.2.           |
| —   | Monitoring             | ⏳     | Grafana + Prometheus + Loki, uptime alerts. v1.2.                                      |
| —   | k8s manifests          | ⏳     | Migrate from Compose to k8s for horizontal scaling. v1.3.                              |

---

## 4. Roadmap (concrete next PRs)

Each item below should be **one PR** unless explicitly noted. PR titles in the
table are suggested — match the existing style (`feat(linkforge): ...` /
`chore(linkforge): ...`).

### v1.1 — production-readiness pass (~2–3 PRs each, ~4–6 weeks team time)

1. **Stripe billing** — `feat(linkforge): stripe subscriptions + checkout + webhooks`
   - Schema: already has `Subscription`, `Coupon`, `WebhookDelivery`. Need
     migration + handlers.
   - Routes: `/api/billing/checkout`, `/api/billing/webhook`, `/api/billing/portal`.
   - UI: `/dashboard/billing`, plan picker, upgrade-CTA wiring on PRO blocks.
2. **Custom domains** — `feat(linkforge): custom domains + ACME automation`
   - Schema: `CustomDomain` already present.
   - Need: ACME-DNS or HTTP-01 multi-domain cert issuance script, Nginx
     dynamic vhost rendering, domain-verification token UI.
3. **Admin panel** — `feat(linkforge): admin dashboard (users, reports, flags)`
   - Routes under `/admin` already gated by `role === ADMIN`.
   - Need: data tables (use `@tanstack/react-table`), audit-log viewer,
     content-report queue, feature-flag UI.
4. **Auth hardening** — `feat(linkforge): 2FA UI, device sessions, suspicious-login email` ✅ **DONE**
   - Schema: `AuditAction` extended (`USER_2FA_*`, `USER_SESSION_*`, `USER_LOGIN_*`); `AuthSession` got `userId/sessionToken/twoFactorPassedAt/ipHash/ipCountry/userAgent/deviceLabel/lastUsedAt/revokedAt`.
   - Libs: `src/lib/totp.ts` (otplib), `src/lib/recovery.ts` (10x base32 codes, hashed at rest), `src/lib/audit.ts`, `src/lib/auth-sessions.ts` (UA/IP fingerprinting + suspicious-login detection), `src/lib/email.ts` (queue helper).
   - Auth flow: `src/auth.ts` Credentials.authorize verifies argon2 password → if 2FA enabled, requires TOTP or recovery code; records `AuthSession`; on new device/country fans out a `USER_LOGIN_NEW_DEVICE` email via the worker.
   - API: `/api/auth/preflight`, `/api/auth/2fa/{setup,enable,disable,recovery-codes}`, `/api/auth/sessions[/:id, /revoke-all]`.
   - UI: `/dashboard/settings/security` with `TwoFactorCard` (QR enrol → verify → reveal recovery codes), `SessionsList` (revoke single / revoke-all-others), `RegenerateCodesCard`. Login form upgraded to two-step (preflight → TOTP/recovery → signIn).
   - Worker: real `nodemailer` SMTP path with graceful no-op when `SMTP_HOST` is unset (logs as `email-send.dry_run`).
   - Tests: `tests/{crypto,recovery,totp}.test.ts` — 17 specs, all passing.
5. **Telegram OAuth** — `feat(linkforge): telegram login widget + callback`
   - Need: `/api/auth/telegram/callback` HMAC verify, widget on login page.
6. **Block library expansion** — `feat(linkforge): TikTok/Spotify/FAQ/countdown/gallery blocks`
   - Add renderers + builder UIs for each.
7. **Realtime analytics dashboard** — `feat(linkforge): realtime dashboard via SSE`
   - Use Redis pub/sub. UI in `/dashboard` cards.
8. **Test suite** — `chore(linkforge): vitest unit + playwright e2e`
   - Start with: auth flow, page CRUD, public renderer, click tracking.

### v1.2 — growth & scale features (~6–10 weeks)

9. **AI features** — `feat(linkforge): ai bio/theme/seo/cta generators`
   - Use OpenAI-compatible API (`AI_BASE_URL`, `AI_MODEL` envs already in
     `.env.example`). Server actions, rate-limited per-user.
10. **A/B testing** — `feat(linkforge): block-level a/b tests`
    - Schema additions: `Experiment`, `Variant`, `Assignment`. Worker
      computes winners.
11. **Themes marketplace** — `feat(linkforge): public theme gallery + remixes`
    - Use existing `Theme` model. Add public listing + remix flow.
12. **Heatmaps + funnels** — `feat(linkforge): scroll/click heatmaps, conversion funnels`
13. **Monitoring** — `chore(linkforge): grafana + prometheus + loki stack`
    - Add to `docker-compose.prod.yml`. Pino → Loki via promtail.
14. **Scheduled posts** — `feat(linkforge): schedule block visibility windows`
15. **Push notifications** — `feat(linkforge): web push for new lead/comment events`

### v1.3 — scale-out

16. **k8s manifests** — `chore(linkforge): kubernetes manifests + helm chart`
17. **Image CDN** — `feat(linkforge): cloudflare images / r2 + sharp pipeline`
18. **ISR for `/u/[slug]`** — `perf(linkforge): incremental static regen for public pages`
19. **Telegram bot** — `feat(linkforge): bot for lead notifications + page edits`
20. **Affiliate / referral system** — `feat(linkforge): referrer attribution + payouts`

---

## 5. Infra reference

### VPS
- IP: `164.92.240.90`
- SSH: port `2222`, user `nurbek` (sudo, key-based auth)
- OS: Ubuntu 24.04 LTS
- Bootstrap: `scripts/setup-vps.sh` (Docker + UFW + fail2ban + SSH hardening)
- TLS: `scripts/ssl-init.sh` (Let's Encrypt via certbot, auto-renew via cron)
- Deploy: `scripts/deploy.sh` (zero-downtime via docker-compose pull + up -d)

### Domains
- Primary: `linkforge.kebruni.me` → `164.92.240.90`
- Wildcard for custom-domains feature (v1.1): `*.linkforge.kebruni.me`
- DNS instructions: `DEPLOYMENT.md` §1

### GitHub Actions secrets required for deploy
- `VPS_HOST=164.92.240.90`
- `VPS_USER=nurbek`
- `VPS_PORT=2222`
- `VPS_SSH_KEY=<private key contents>`
- `LETSENCRYPT_EMAIL=admin@kebruni.me`

### Tech stack pin (don't drift without good reason)
- Node `>=20.10.0`, pnpm `9.12.3` (via `packageManager` in `package.json`).
- Next.js `15.1.3`, React `19.0.0`, TypeScript `5.7.2`.
- Prisma `5.22.0`, Postgres 16.
- Redis 7 (BullMQ-compatible).
- Auth.js `5.0.0-beta.25`.

---

## 6. How to continue (concrete instructions for the next agent)

1. **Read these in order:** this file → `ARCHITECTURE.md` → `DEPLOYMENT.md` →
   `prisma/schema.prisma`.
2. **Sanity-check the current scaffold runs locally:**
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   pnpm install
   pnpm prisma migrate dev --name init   # NOTE: no migrations committed yet
   pnpm prisma db seed
   pnpm dev
   pnpm worker  # in another terminal
   ```
3. **Pick one PR from §4 Roadmap.** Don't try to do multiple at once.
4. **Branch naming:** `devin/<unix-ts>-<descriptive-slug>` (matches what's
   already in the repo).
5. **Before opening a PR, locally:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
   The CI workflow runs the same gates.
6. **PR base = `main` after rename**, otherwise `base`. Never push directly
   to `main`.
7. **Update this file** at the end of your session — move done items from
   the deferred table into the "MVP" table, append a "Last updated" line.

---

## 7. Open questions / blocked items

- **Repo rename `base` → `main`.** Needs the user to do it in GitHub Settings →
  Branches. After that, change CI/CD `branches: [main]` filters and the
  `PR base` default.
- **First deploy to the VPS hasn't happened.** Run `setup-vps.sh` →
  `ssl-init.sh` → first `deploy.sh` from a workstation that has the deploy
  SSH key. See `DEPLOYMENT.md` §2–4.
- **No Prisma migrations committed.** Whoever runs the first deploy must
  produce them via `prisma migrate dev --name init` and commit the
  `prisma/migrations/` folder.
- **Vitest has no test files.** Currently CI passes with `--passWithNoTests`.
  v1.1 PR #8 should remove that flag and add real tests.
- **Two GitHub PATs were leaked in chat.** User declined to revoke. Anyone
  with chat-log access can push to `kebruni/Linkforge` until they're rotated.

---

## 8. Glossary (for new agents)

- **Block** — atomic unit of a page (link, text, button, embed, form, etc.).
  Stored in `Block` table, ordered by `position` within a `Page`.
- **Page** — a user's link-in-bio page at `/u/<slug>`. Has many blocks, one
  theme, optionally one custom domain.
- **Theme** — visual config (colors, fonts, radius, preset). Stored on `Page`
  via `themeJson` and reusable via `Theme` model.
- **Reserved slug** — username/path that can't be claimed by users (e.g.
  `admin`, `api`, `linkforge`). Seeded by `prisma/seed.ts`.
- **Worker** — `worker/index.ts`. Drains the `analytics:stream` Redis stream,
  enriches events with GEO/UA, and writes to `AnalyticsEvent` +
  `AnalyticsDaily`.
- **Edge-safe auth config** — `src/auth.config.ts`. Used by `middleware.ts`
  (which runs at the Vercel/Next edge, no Node APIs).
- **Node-only auth config** — `src/auth.ts`. Adds Credentials + argon2 +
  Prisma adapter. Used by route handlers and server actions.
