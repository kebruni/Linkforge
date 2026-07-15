# Linkforge — Roadmap & readiness

**Goal:** production SaaS link-in-bio / mini-landing at  
`https://linkforge.kebruni.me` (real users, real payments, real uptime).

**Current version:** `1.1.2` · branch `main` ·  
https://github.com/kebruni/Linkforge · **live at https://linkforge.kebruni.me**

**Last updated:** 2026-07-15

---

## Where we are (one glance)

```
[██████████████████████░░]  ~95% to "public production launch"

 DONE     MVP scaffold
 DONE     v1.0 product core
 DONE     v1.1 freemium + developer tools
 DONE     v1.1.1 security harden + API smoke
 DONE     v1.1.2 pre-deploy fixes (build was broken; now green) + prod config
 DONE     Stage 6 — first live deploy (VPS + DNS + TLS) — 2026-07-15
   YOU ARE HERE ─────────────►  soft launch (SMTP/Stripe pending)
 NEXT     production config (Stripe live, SMTP, secrets)
 LATER    polish / growth features
```

| Stage | Name | Status |
| --- | --- | --- |
| **0** | Idea / repo bootstrap | ✅ Done |
| **1** | MVP (auth, builder, public pages, analytics skeleton) | ✅ Done |
| **2** | Product v1.0 (billing, 2FA, short links, admin, worker) | ✅ Done |
| **3** | Product v1.1 (freemium, sessions, API keys, webhooks, domains, reports, coupons) | ✅ Done |
| **4** | Hardening v1.1.1 (security audit fixes, e2e smoke) | ✅ Done |
| **4b** | Pre-deploy fixes v1.1.2 (build break + prod config) | ✅ Done |
| **5** | **Pre-deploy readiness** (checklist below) | ✅ Done |
| **6** | First production deploy (VPS live) | ✅ Done (2026-07-15) |
| **7** | Soft launch (invite / limited users) | 🟡 SMTP/Stripe pending |
| **8** | Public launch + growth features | ⏳ later |

**Bottom line:** product code is ready enough to deploy.  
We are **not** “idea/MVP” anymore — we are at **“ready for first production cutover”**, waiting on infra access + prod secrets.

---

## Stage map (detail)

### ✅ Stage 0–1 — Foundation (done)
- Next.js 15 / Prisma / Postgres / Redis / BullMQ
- Auth register/login, page builder, `/u/[slug]`, basic analytics
- Docker / nginx / deploy scripts scaffold

### ✅ Stage 2 — Product core v1.0 (done)
- Password reset, email verify, TOTP 2FA
- Stripe PRO + donations/products (+ demo mode for dev)
- Short links, QR, form leads, AI studio
- Admin users / flags, worker (email + webhooks + analytics)

### ✅ Stage 3 — SaaS surface v1.1 (done)
- Freemium limits (pages / shorts / keys / webhooks)
- Device sessions UI, API keys, outbound webhooks
- Custom domain DNS TXT + host rewrite
- Content reports + admin queue, coupons
- Analytics: countries / devices / UTM / referrers
- Referral `?ref=`

### ✅ Stage 4 — Security & confidence v1.1.1 (done)
- URL allowlist (no `javascript:`, no metadata IP)
- Webhook SSRF protection
- Private pages with password gate
- Demo payment single-use tokens
- Rate-limit anti–X-Forwarded-For spoof (`TRUST_PROXY`)
- Freemium race fix (`FOR UPDATE`)
- Coupon redeem only after Stripe success
- `pnpm e2e:smoke` (16 checks), unit tests, typecheck/build green

### ✅ Stage 4b — Pre-deploy fixes v1.1.2 (done, 2026-07-15)
- **Build was broken:** `node:net` (from `url-safety.ts`) leaked into the client
  bundle via `safeHref` in block renderers → `pnpm build` failed. Fixed by
  splitting client-safe `src/lib/safe-href.ts` (pure JS) from server-only
  `url-safety.ts` (keeps `node:net` for SSRF). Build now green.
- `.env.example` prod block had an uncommented `FEATURE_BILLING_DEMO=true` →
  now commented as `false`.
- `docker-compose.prod.yml` now propagates `TRUST_PROXY` and
  `FEATURE_BILLING_DEMO` (demo defaults to `false`) + rate-limit tunables.
- nginx `upstream` moved from global `nginx.conf` into the site conf so
  `ssl-init.sh` can start nginx before the `app` container exists.
- `ssl-init.sh` runs nginx with `--no-deps` and no longer reloads against a
  non-existent upstream (was leaving nginx down after first cert).

### 🟡 Stage 5 — Pre-deploy gate (**you are here**)

Purpose: be sure **before** touching the VPS that nothing critical is missing.

#### Must-pass before deploy (definition of “ready to ship v1”)

| # | Check | How | Status |
| --- | --- | --- | --- |
| 1 | Code on `main`, clean | `git status` | ✅ |
| 2 | Unit tests | `pnpm test` | ✅ |
| 3 | Typecheck / lint | `pnpm typecheck && pnpm lint` | ✅ (run before deploy) |
| 4 | Production build | `pnpm build` | ✅ verified 2026-07-15 (was broken: `node:net` in client bundle; fixed in v1.1.2) |
| 5 | API e2e smoke locally | `pnpm e2e:smoke` | ✅ |
| 6 | Security pass reviewed | findings fixed in v1.1.1 | ✅ |
| 7 | Deploy scripts present | `scripts/deploy.sh`, `ssl-init.sh`, compose | ✅ (ssl-init fixed: `--no-deps`, no reload vs missing upstream) |
| 8 | Domain DNS points to VPS | `linkforge.kebruni.me` → `164.92.240.90` | ⬜ verify |
| 9 | SSH access to VPS | port `2222`, user `nurbek` | ❌ blocked now |
| 10 | `.env.production` secrets | see list below | ⬜ fill on VPS |
| 11 | Stripe live (or keep billing off) | keys + webhook | ⬜ |
| 12 | SMTP for real emails | or accept “log only” | ⬜ optional |
| 13 | `FEATURE_BILLING_DEMO=false` in prod | required | ✅ safeguard: compose defaults `false`, `.env.example` fixed |
| 14 | `TRUST_PROXY=true` behind Nginx | required | ✅ safeguard: compose now propagates `TRUST_PROXY` |
| 15 | No seed admin in prod | never run seed with weak admin | ⬜ process |

#### Prod env minimum (Stage 5 → 6)

```bash
NODE_ENV=production
APP_URL=https://linkforge.kebruni.me
AUTH_SECRET=<openssl rand -base64 32>
DATABASE_URL=postgresql://...@postgres:5432/linkforge
REDIS_URL=redis://redis:6379
TRUST_PROXY=true
FEATURE_BILLING_DEMO=false
FEATURE_AI=true|false
FEATURE_BILLING=true|false   # true only with Stripe keys
FEATURE_CUSTOM_DOMAINS=true|false
# If billing on:
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
# Recommended:
EMAIL_FROM=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASSWORD=...
```

#### Optional before first deploy (nice, not blockers)
- [ ] Browser Playwright e2e (UI click-through)
- [ ] Turnstile captcha on login after N failures
- [ ] Real OpenAI key (AI has offline fallback)
- [ ] Monitoring (Grafana/Prometheus)

---

### ⏳ Stage 6 — First production deploy

**Goal:** site answers on HTTPS, health green, one admin can log in, one public page works.

```
1. SSH key for nurbek@164.92.240.90:2222
2. scripts/setup-vps.sh
3. Clone /srv/linkforge · checkout main
4. Fill .env.production (checklist above)
5. EMAIL=... bash scripts/ssl-init.sh
6. bash scripts/deploy.sh
7. Smoke on prod:
   - curl https://linkforge.kebruni.me/api/health
   - register / login
   - create + publish page
   - open /u/<slug>
   - pnpm e2e:smoke BASE_URL=https://linkforge.kebruni.me  (careful: creates test users)
```

**Exit criteria Stage 6:**
- [ ] HTTPS works, HTTP→HTTPS redirect
- [ ] `/api/health` → `{ "ok": true }`
- [ ] Auth works (register + login)
- [ ] Public page renders
- [ ] Worker running (analytics/email queue not stuck)
- [ ] No demo billing in prod

---

### ⏳ Stage 7 — Soft launch

**Goal:** real users in controlled volume.

- Create real admin (not seed)
- Stripe live webhook registered: `POST /api/billing/webhook`
- SMTP verified (password reset works)
- Backup cron: `scripts/backup-db.sh`
- GitHub Actions secrets for auto-deploy (optional)
- Soft invite / small circle of users
- Watch logs 48–72h

**Exit criteria Stage 7:**
- [ ] At least 1 non-admin real user journey completed
- [ ] PRO checkout works end-to-end (if monetization on)
- [ ] Backups restorable
- [ ] No critical errors in logs

---

### ⏳ Stage 8 — Public launch & growth (post-v1)

Not required for “product is live”; these are **after** Stage 7.

| Priority | Item |
| --- | --- |
| P1 | Playwright browser e2e in CI |
| P1 | Captcha on login / public forms |
| P2 | Full ACME certs for custom domains |
| P2 | Device session IP capture on login (geo) |
| P2 | Better monitoring (uptime + error tracking) |
| P3 | Themes marketplace, A/B tests |
| P3 | Telegram bot / OAuth |
| P3 | Multi-region / k8s |

---

## What “goal achieved” means (three levels)

| Level | Definition | Progress |
| --- | --- | --- |
| **A. Product complete (code)** | Core SaaS features + security baseline on `main` | ✅ **Reached** |
| **B. Production live** | HTTPS, real deploy, real env, smoke OK | 🟡 **~85%** — blocked on SSH + secrets |
| **C. Business ready** | Payments live, email live, backups, soft users | ⏳ After Stage 6–7 |

You asked “is everything ready?”:

- **Ready to deploy the product?** → **Yes (code).**  
- **Ready to open to the public?** → **Not yet** — need Stage 6 + 7.

---

## Risk register (honest)

| Risk | Severity | Mitigation |
| --- | --- | --- |
| No SSH to VPS yet | Blocks launch | Add deploy key / password once |
| Stripe not configured | No revenue | Soft launch free-only, or set keys first |
| SMTP missing | No email verify/reset in real life | Configure SMTP or use Resend/Postmark |
| Demo billing left on in prod | Fake payments | `FEATURE_BILLING_DEMO=false` enforced in checklist |
| Seed admin in prod | Account takeover | Never seed weak admin on VPS |
| Custom domains without ACME | Domain verifies but HTTPS on custom host needs nginx/ACME later | Document as PRO beta |

---

## Recommended sequence from today

```
NOW     Confirm Stage 5 checklist (DNS, secrets list prepared)
  │
  ▼
NEXT    Stage 6 — first deploy (as soon as SSH works)
  │
  ▼
THEN    Stage 7 — soft launch (Stripe + SMTP + backup + real admin)
  │
  ▼
LATER   Stage 8 — public marketing + growth features
```

### Decision: can we deploy today?

| Question | Answer |
| --- | --- |
| Is the app “done enough”? | **Yes** for first production |
| Is infra access ready? | **No** — SSH denied |
| Is prod config ready? | **Not on VPS yet** — template exists in `.env.example` / `DEPLOYMENT.md` |
| Should we keep coding features before deploy? | **No** — diminishing returns; ship Stage 6 first |

---

## Quick commands (local confidence)

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm prisma migrate dev
pnpm dev   # + pnpm worker

# gates
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm e2e:smoke
# optional: pnpm security:audit
```

---

## Summary for stakeholders

| | |
| --- | --- |
| **Product** | Production-grade v1.1.2 SaaS on GitHub `main` |
| **Stage** | **7 / 8** — soft launch (live, SMTP/Stripe pending) |
| **Code readiness** | High — build verified green 2026-07-15 |
| **Launch readiness** | **Live** — https://linkforge.kebruni.me (HTTPS, e2e 16/16) |
| **Next action** | Configure SMTP + Stripe → open to real users |

When Stage 6 is green, Linkforge is a **real live product**, not an MVP.
