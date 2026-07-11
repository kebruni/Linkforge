# Linkforge — Project context for future agents (handover doc)

> **For other AIs / engineers picking this up:** this is the single source of truth
> for **what was asked, what's done, what's in progress, and what's next**. Read
> this top-to-bottom before doing anything. Then read `ARCHITECTURE.md` (system
> design) and `DEPLOYMENT.md` (VPS guide).

Last updated: **2026-07-10** (v1.1 production product).

---

## 0. TL;DR

- Goal: **production link-in-bio / mini-landing SaaS** branded **Linkforge**,
  target deploy `https://linkforge.kebruni.me`
  (VPS `164.92.240.90`, SSH `:2222`, deploy user `nurbek`).
- Status: **v1.1 production product** — freemium limits, device sessions, API
  keys, webhooks, custom domains (DNS TXT verify + host rewrite), content
  reports + admin moderation, coupons, UTM/geo/device analytics, referral
  tracking, optional Turnstile captcha, Stripe billing + demo fallback.
- **Live VPS cutover** still needs SSH key + first `setup-vps` / `ssl-init` /
  `deploy` if not already done on the server.

---

## 1. Original requirements (summary)

Full 20-section ask (auth, builder, analytics, AI, monetization, admin, deploy,
etc.) — see git history / ARCHITECTURE.md. Delivery is phased: solid product
core + monetization + developer tools rather than every marketplace/bot idea.

---

## 2. Decisions

| Decision | Why |
| --- | --- |
| Freemium: free 3 pages / 10 short links | Real SaaS gating; PRO unlimited |
| API keys + webhooks = PRO | Monetisation + abuse control |
| Custom domains = PRO + `FEATURE_CUSTOM_DOMAINS` | DNS verify + middleware rewrite |
| Billing demo only when `FEATURE_BILLING_DEMO` | Dev without Stripe keys |
| System user `reports@linkforge.system` | Anonymous public content reports |
| AuthSession table + JWT | Device list without full server sessions |

---

## 3. Status

### Shipped (v1.1)

| Area | Status | Notes |
| --- | --- | --- |
| Auth | ✅ | credentials, OAuth, reset, verify, TOTP 2FA, device sessions, login audit |
| Dashboard | ✅ | overview, pages, analytics, leads, shorts, AI, settings |
| Page builder | ✅ | dnd blocks, theme, live preview, QR, custom domain panel |
| Analytics | ✅ | daily rollups, chart, countries/devices/UTM/referrers |
| AI | ✅ | studio + offline fallbacks + OpenAI when keyed |
| Monetization | ✅ | Stripe sub + one-time + coupons + demo checkout |
| Admin | ✅ | users, reports queue, coupons, feature flags |
| Developer | ✅ | API keys, outbound webhooks (HMAC via worker) |
| Custom domains | ✅ | TXT verify, Redis-cached host resolve, middleware rewrite |
| Security | ✅ | rate limits, 2FA, audit log, optional Turnstile, report page |
| Deploy stack | ✅ | Docker, nginx, scripts, CI — first live deploy may still be pending |

### Still later (nice-to-have)

- Playwright e2e suite
- Full ACME cert issuance per custom domain (today: DNS verify + reverse-proxy config)
- Telegram OAuth / bot
- Themes marketplace, A/B testing
- Prometheus/Grafana stack
- PayPal

---

## 4. Plan limits (`src/lib/plan.ts`)

| Resource | Free (USER) | PRO / ADMIN |
| --- | --- | --- |
| Pages | 3 | unlimited |
| Short links | 10 | unlimited |
| API keys | 0 | 10 |
| Webhooks | 0 | 20 |
| Custom domains | no | yes (flag on) |

---

## 5. Infra

### VPS
- IP: `164.92.240.90`
- SSH: port `2222`, user `nurbek`
- Path: `/srv/linkforge`
- Scripts: `setup-vps.sh`, `ssl-init.sh`, `deploy.sh`

### Domains
- Primary: `linkforge.kebruni.me`

### Local
```bash
docker compose -f docker-compose.dev.yml up -d
pnpm install
cp .env.example .env   # AUTH_SECRET + DATABASE_URL :5433
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev               # + pnpm worker
```
Gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Seed admin: `admin@linkforge.local` / `password123` (**dev only**).

---

## 6. Key routes added in v1.1

- `GET/DELETE /api/sessions`, `DELETE /api/sessions/[id]`
- `GET/POST /api/api-keys`, `DELETE /api/api-keys/[id]`
- `GET/POST /api/webhooks`, `PATCH/DELETE /api/webhooks/[id]`
- `GET/POST/PUT/DELETE /api/pages/[id]/domain`
- `POST /api/reports`
- `GET/PATCH /api/admin/reports`
- `GET/POST /api/admin/coupons`
- `GET /api/internal/resolve-host`

---

## 7. Open / blocked

- First VPS deploy from this machine if SSH key not provisioned.
- GitHub Actions secrets: `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`.
- Production: set `FEATURE_BILLING_DEMO=false` + real Stripe keys.
- Optional: Turnstile keys for form captcha.
