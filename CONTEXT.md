# Linkforge — Project context for future agents (handover doc)

> **For other AIs / engineers picking this up:** this is the single source of truth
> for **what was asked, what's done, what's in progress, and what's next**. Read
> this top-to-bottom before doing anything. Then read `ARCHITECTURE.md` (system
> design) and `DEPLOYMENT.md` (VPS guide).

Last updated: **2026-07-10** (v1.1.1 security + e2e smoke).

---

## 0. TL;DR

- Goal: **production link-in-bio / mini-landing SaaS** branded **Linkforge**,
  target deploy `https://linkforge.kebruni.me`
  (VPS `164.92.240.90`, SSH `:2222`, deploy user `nurbek`).
- Status: **v1.1.1 on `main`** — full product surface + security hardening pass
  (URL allowlists, private pages, rate-limit anti-spoof, demo single-use,
  freemium race lock, webhook SSRF blocks) + API e2e smoke script.
- **Live VPS cutover** still needs SSH key for `nurbek@164.92.240.90:2222`.

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

- VPS: `164.92.240.90:2222` user `nurbek` → `/srv/linkforge`
- Domain: `linkforge.kebruni.me`
- Local: Postgres host `:5433`, `pnpm dev` + `pnpm worker`
- Seed: `admin@linkforge.local` / `password123` (**dev only**)

GitHub: `https://github.com/kebruni/Linkforge` default branch **`main`**.

---

## 5. Key modules

| Module | Path |
| --- | --- |
| URL / SSRF safety | `src/lib/url-safety.ts` |
| Client IP | `src/lib/client-ip.ts` |
| Page unlock | `src/lib/page-unlock.ts` |
| Plan gates | `src/lib/plan.ts` |
| Demo pay tokens | `src/lib/billing-demo.ts` |
| E2E smoke | `scripts/e2e-smoke.mjs` |
| Security harness | `scripts/stress-security-audit.mjs` |
