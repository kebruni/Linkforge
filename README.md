# Linkforge

Production link-in-bio / mini-landing SaaS — live at **[linkforge.kebruni.me](https://linkforge.kebruni.me)**.

Built on Next.js 15, Prisma, PostgreSQL, Redis, BullMQ, and Stripe.

---

## Features

- **Auth** — email/password, OAuth (Google, GitHub), email verify, password reset, TOTP 2FA, device sessions with revocation
- **Page builder** — drag-and-drop blocks (link, button, text, image, video, embed, social, FAQ, gallery, countdown, form, map, donation, product), live preview, theme editor with CSS variables, QR generator
- **Public renderer** — SSR pages at `/u/[slug]`, SEO + OpenGraph + Twitter cards + JSON-LD, click tracking, bot filtering, password-protected private pages
- **Analytics** — views, clicks, uniques, geo (country), device/browser/OS, UTM parameters, referrers, per-block CTR, realtime dashboard via Redis streams
- **Freemium** — plan limits (pages, short links, API keys, webhooks, custom domains) enforced with `SELECT … FOR UPDATE` race protection
- **Billing** — Stripe subscriptions (PRO monthly/yearly), coupons, donations, digital products, customer portal, webhook reconciler, demo mode for dev
- **Short links** — branded URL shortener with click tracking
- **Developer tools** — API keys (hashed, scoped), outbound webhooks with SSRF protection, custom domains (DNS TXT verification)
- **Admin** — user management, content reports/moderation queue, feature flags, coupon management
- **AI studio** — bio generator, theme suggester, CTA optimizer, SEO audit, username suggester (OpenAI-compatible, offline fallbacks)
- **Security** — URL allowlists (no `javascript:`, private IPs, metadata endpoints), webhook SSRF blocks, rate-limit anti-spoof (`TRUST_PROXY`), demo single-use tokens, HSTS, CSP, security headers

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 (App Router, RSC), React 19, TypeScript, Tailwind, shadcn/ui |
| State | Zustand, TanStack Query, React Hook Form + Zod |
| Backend | Next.js Route Handlers + Server Actions, BullMQ worker |
| Database | PostgreSQL 16 + Prisma 5 |
| Cache/queue | Redis 7 + BullMQ |
| Auth | Auth.js v5 (NextAuth), OAuth, TOTP 2FA, device sessions |
| Storage | S3-compatible (Cloudflare R2 / MinIO) |
| Payments | Stripe (subscriptions + one-shot) |
| Proxy | Nginx (HTTP/2, gzip, rate-limit, security headers) |
| TLS | Let's Encrypt via certbot (auto-renew) |

---

## Quick start (local dev)

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres :5433 + Redis
cp .env.example .env                              # set DATABASE_URL, AUTH_SECRET
pnpm prisma migrate dev
pnpm prisma db seed                               # dev seed (themes, reserved slugs)
pnpm dev                                          # http://localhost:3000
pnpm worker                                       # background jobs (separate terminal)
```

Public pages at `/u/<slug>`, dashboard at `/dashboard`.

---

## Quality gates

```bash
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest (29 tests)
pnpm build         # Next.js + worker build
pnpm e2e:smoke     # 16 API checks (requires running app)
```

---

---

## Project structure

```
src/
├── app/              # Next.js App Router (marketing, auth, dashboard, admin, u/[slug], api/)
├── components/       # UI primitives, builder, dashboard, public blocks, marketing
├── features/         # Feature-grouped logic (auth, builder, analytics, billing, ai, admin)
├── lib/              # Cross-cutting infra (prisma, redis, auth, env, rate-limit, url-safety, etc.)
├── server/           # Server actions + domain services
worker/               # BullMQ workers (email, analytics, AI, webhooks)
prisma/               # Schema + migrations + seed
scripts/              # Deploy, SSL, backup, e2e smoke, security audit
nginx/                # Production nginx config + snippets
docker-compose.prod.yml
Dockerfile
```

---

## Plan limits

| Resource | Free | PRO |
| --- | --- | --- |
| Pages | 3 | unlimited |
| Short links | 10 | unlimited |
| API keys | 0 | 10 |
| Webhooks | 0 | 20 |
| Custom domains | no | yes |

---

## License

MIT
