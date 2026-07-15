# Linkforge — Project context for future agents (handover doc)

> **For other AIs / engineers picking this up:** this is the single source of truth
> for **what was asked, what's done, what's in progress, and what's next**. Read
> this top-to-bottom before doing anything. Then read `ARCHITECTURE.md` (system
> design) and `DEPLOYMENT.md` (VPS guide).

Last updated: **2026-07-15** (v1.1.2 — deployed to production).

---

## 0. TL;DR

- Goal: **production link-in-bio / mini-landing SaaS** branded **Linkforge**,
  live at **`https://linkforge.kebruni.me`**
  (VPS `164.92.240.90`, SSH `:2222`, deploy user `nurbe`).
- Status: **v1.1.2 deployed to production** — full product surface + security
  hardening + live HTTPS deploy with valid Let's Encrypt cert.
- **Pre-deploy fixes (2026-07-15):** the production `pnpm build` was actually
  broken (`node:net` from `url-safety.ts` leaked into the client bundle via
  `safeHref` in block renderers) — fixed by splitting client-safe
  `src/lib/safe-href.ts` (pure JS) from the server-only `url-safety.ts`. Also
  fixed: `.env.example` prod block had an uncommented `FEATURE_BILLING_DEMO=true`
  (now `false`); `docker-compose.prod.yml` did not propagate `TRUST_PROXY` /
  `FEATURE_BILLING_DEMO` to the container (now wired, demo defaults to `false`);
  nginx `upstream` lived in global `nginx.conf` so `ssl-init.sh` could not start
  nginx before the `app` container existed (moved upstream into the site conf);
  `ssl-init.sh` now runs nginx with `--no-deps` and no longer reloads against a
  non-existent upstream. All gates green: `lint`, `typecheck`, `test` (29),
  `build` (+ worker).
- **Production deploy (2026-07-15):** Docker image built locally, transferred
  to VPS, app + worker containers running on existing Docker network with
  existing Postgres 16 + Redis 7 containers. Host nginx reverse-proxies
  `linkforge.kebruni.me` → `127.0.0.1:3001`. SSL via certbot (Let's Encrypt,
  auto-renew). E2E smoke: 16/16 passed on production. Admin user created
  (`admin@kebruni.me`). Backup cron at 3am daily, 14-day retention.
- **Remaining for full business readiness:** SMTP config (email verify/reset),
  Stripe live keys (billing currently off), OAuth provider keys (Google/GitHub).

---

## 1. Shipped product surface

Auth (OAuth, reset, verify, TOTP 2FA, device sessions), freemium limits, page
builder, public `/u/[slug]`, analytics (UTM/geo/device), AI studio, Stripe
billing + coupons, short links, API keys, webhooks, custom domains (DNS TXT),
admin (users/reports/coupons/flags), QR, form leads, deploy stack.

### Security pass (v1.1.1)

| Area | Hardening |
| --- | --- |
| Links / shorts | http(s) only; block `javascript:`, private IPs, metadata |
| Webhooks | SSRF allowlist + worker re-check |
| Private pages | password + signed unlock cookie |
| Demo billing | single-use Redis nonce |
| Rate limits | `TRUST_PROXY` + `clientIp()` (ignore spoofed XFF when false) |
| Freemium | `SELECT … FOR UPDATE` on User during page create |
| Coupons | redeem only on Stripe `checkout.session.completed` |
| Checkout return | always `APP_URL` (no Host header trust) |
| Login | per-email + per-IP rate limits |
| Health | production returns `{ ok }` only |

### Commands

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm e2e:smoke              # app must be running on :3000
pnpm security:audit         # optional stress harness
```

---

## 2. Plan limits (`src/lib/plan.ts`)

| Resource | Free | PRO |
| --- | --- | --- |
| Pages | 3 | unlimited |
| Short links | 10 | unlimited |
| API keys | 0 | 10 |
| Webhooks | 0 | 20 |
| Custom domains | no | yes + flag |

---

## 3. Roadmap next

1. **First VPS deploy** — SSH key → `setup-vps` → `ssl-init` → `deploy`
   - prod: `TRUST_PROXY=true`, `FEATURE_BILLING_DEMO=false`, real Stripe
2. **Playwright UI e2e** (browser) on top of `e2e:smoke`
3. **ACME certs** for custom domains (beyond DNS verify)
4. Captcha (Turnstile) on login after N failures
5. Themes marketplace / A/B / Telegram bot (later)

---

## 4. Infra

- VPS: `164.92.240.90:2222` user `nurbe` → `/srv/linkforge`
- Domain: `linkforge.kebruni.me` (live, HTTPS, Let's Encrypt)
- Prod: Docker image `linkforge:latest` → app (`127.0.0.1:3001`) + worker
  on existing `docker_linkforge-network` with existing Postgres 16 + Redis 7
- Host nginx reverse-proxies `linkforge.kebruni.me` → `127.0.0.1:3001`
- Local: Postgres host `:5433`, `pnpm dev` + `pnpm worker`
- Admin: `admin@kebruni.me` (created on prod, promoted to ADMIN)
- Backup: cron `0 3 * * *` → `/srv/linkforge/backups/`, 14-day retention

GitHub: `https://github.com/kebruni/Linkforge` default branch **`main`**.

---

## 5. Key modules

| Module | Path |
| --- | --- |
| URL / SSRF safety | `src/lib/url-safety.ts` |
| Client IP | `src/lib/client-ip.ts` |
| Page unlock | `src/lib/page-unlock.ts` |
| Client-safe href sanitiser | `src/lib/safe-href.ts` (pure JS, no `node:net`) |
| Plan gates | `src/lib/plan.ts` |
| Demo pay tokens | `src/lib/billing-demo.ts` |
| E2E smoke | `scripts/e2e-smoke.mjs` |
| Security harness | `scripts/stress-security-audit.mjs` |
