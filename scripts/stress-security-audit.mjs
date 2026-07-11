/**
 * Linkforge stress + security audit harness (local only).
 * Run: node scripts/stress-security-audit.mjs
 */
import { createHash, randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const findings = [];
const ok = [];

function finding(severity, title, detail, evidence = {}) {
  findings.push({ severity, title, detail, evidence });
  const tag = { critical: "CRIT", high: "HIGH", medium: "MED", low: "LOW", info: "INFO" }[severity];
  console.log(`[${tag}] ${title}`);
  if (detail) console.log(`       ${detail}`);
}

function pass(title) {
  ok.push(title);
  console.log(`[OK]   ${title}`);
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  let body = opts.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers["content-type"] = headers["content-type"] || "application/json";
    body = JSON.stringify(body);
  }
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body,
      redirect: opts.redirect || "manual",
    });
  } catch (err) {
    return { ok: false, status: 0, error: String(err), ms: Date.now() - t0, json: null, text: "", headers: new Headers() };
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return {
    ok: res.ok,
    status: res.status,
    ms: Date.now() - t0,
    json,
    text: text.slice(0, 2000),
    headers: res.headers,
    location: res.headers.get("location"),
  };
}

async function register(email, username, password = "StressTest1!") {
  return req("/api/auth/register", {
    method: "POST",
    body: { email, username, password, name: "Stress" },
  });
}

/** Login via NextAuth credentials CSRF flow */
async function login(email, password = "StressTest1!") {
  const jar = new Map();
  const absorb = (res) => {
    for (const c of res.headers.getSetCookie?.() || []) {
      const part = c.split(";")[0];
      jar.set(part.split("=")[0], part);
    }
  };

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
    redirect: "false",
  });

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: [...jar.values()].join("; "),
      "x-auth-return-redirect": "1",
    },
    body,
    redirect: "manual",
  });
  absorb(res);

  const sessionCookie = [...jar.values()].join("; ");
  const hasSession = jar.has("authjs.session-token") || jar.has("__Secure-authjs.session-token");
  return { status: res.status, cookie: sessionCookie, ok: hasSession };
}

async function authed(path, cookie, opts = {}) {
  return req(path, {
    ...opts,
    headers: { ...(opts.headers || {}), cookie },
  });
}

function rand() {
  return randomBytes(4).toString("hex");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function testHealth() {
  const r = await req("/api/health");
  if (r.status === 200) pass("health endpoint responds");
  else finding("high", "Health endpoint down", `status=${r.status}`);
  // info leak?
  if (r.json && (r.json.version || r.json.env || r.json.database)) {
    finding("low", "Health may leak stack details", JSON.stringify(r.json).slice(0, 200));
  }
}

async function testUnauthProtected() {
  const paths = [
    ["/api/me", "GET"],
    ["/api/pages", "GET"],
    ["/api/pages", "POST", { title: "hack", slug: "hack-" + rand() }],
    ["/api/sessions", "GET"],
    ["/api/api-keys", "GET"],
    ["/api/webhooks", "GET"],
    ["/api/admin/reports", "GET"],
    ["/api/admin/coupons", "GET"],
    ["/api/billing/checkout", "POST", { plan: "PRO_MONTHLY" }],
    ["/api/ai/generate", "POST", { kind: "bio", prompt: "x" }],
  ];
  for (const [path, method, body] of paths) {
    const r = await req(path, { method, body });
    if (r.status === 401 || r.status === 403) pass(`unauth blocked ${method} ${path}`);
    else if (r.status === 400 && path.includes("billing")) pass(`unauth billing rejected ${path}`);
    else finding("high", `Unauth access not blocked: ${method} ${path}`, `status=${r.status} body=${r.text.slice(0, 120)}`);
  }
}

async function testAdminWithoutRole(cookie) {
  const r = await authed("/api/admin/reports", cookie);
  if (r.status === 403 || r.status === 401) pass("non-admin cannot list reports");
  else finding("critical", "Non-admin can access admin reports", `status=${r.status}`);

  const r2 = await authed("/api/admin/users/doesnotexist", cookie, {
    method: "PATCH",
    body: { role: "ADMIN" },
  });
  if (r2.status === 403 || r2.status === 401) pass("non-admin cannot promote users");
  else finding("critical", "Privilege escalation: non-admin PATCH /api/admin/users", `status=${r2.status} ${r2.text.slice(0, 100)}`);
}

async function testIdor(cookieA, cookieB, pageIdA) {
  // B tries to PATCH A's page
  const r = await authed(`/api/pages/${pageIdA}`, cookieB, {
    method: "PATCH",
    body: { title: "HIJACKED" },
  });
  if (r.status === 404 || r.status === 403) pass("IDOR blocked: B cannot edit A's page");
  else finding("critical", "IDOR: user B can edit user A's page", `status=${r.status} ${r.text.slice(0, 150)}`);

  // B tries to delete A's page
  const r2 = await authed(`/api/pages/${pageIdA}`, cookieB, { method: "DELETE" });
  if (r2.status === 404 || r2.status === 403) pass("IDOR blocked: B cannot delete A's page");
  else finding("critical", "IDOR: user B can delete user A's page", `status=${r2.status}`);

  // B tries to add block to A's page
  const r3 = await authed(`/api/pages/${pageIdA}/blocks`, cookieB, {
    method: "POST",
    body: { type: "TEXT", content: { text: "pwned" } },
  });
  if (r3.status === 404 || r3.status === 403) pass("IDOR blocked: B cannot add blocks to A's page");
  else finding("critical", "IDOR: user B can add blocks to A's page", `status=${r3.status}`);
}

async function testMassAssignment(cookie) {
  const r = await authed("/api/me", cookie, {
    method: "PATCH",
    body: { name: "x", role: "ADMIN", twoFactorEnabled: false, email: "evil@evil.com" },
  });
  if (r.status === 200 && r.json?.data?.role === "ADMIN") {
    finding("critical", "Mass assignment: can set role=ADMIN via /api/me", r.json);
  } else if (r.status === 200) {
    const me = await authed("/api/me", cookie);
    if (me.json?.data?.role === "ADMIN") finding("critical", "Role escalated to ADMIN", me.json);
    else pass("Mass assignment role/email ignored on /api/me");
  } else {
    pass(`Mass assignment rejected status=${r.status}`);
  }
}

async function testRegistrationAbuse() {
  // weak password
  const weak = await register(`weak-${rand()}@test.local`, `wk${rand()}`, "123");
  if (weak.status === 400) pass("weak password rejected");
  else finding("medium", "Weak password accepted", `status=${weak.status}`);

  // reserved / admin-like
  const reserved = await register(`rsv-${rand()}@test.local`, "admin", "StressTest1!");
  // may fail on username taken or reserved
  if (reserved.status >= 400) pass("username admin rejected or taken");
  else finding("low", "Username 'admin' allowed", reserved.json);

  // SQL-ish username
  const sqli = await register("sql-" + rand() + "@test.local", "ab", "StressTest1!");
  // username min 3 + slug rules
  if (sqli.status === 400) pass("too short username rejected");

  // injection in email
  const injEmail = "x' OR 1=1 --@test.local";
  const inj = await register(injEmail, "inj" + rand(), "StressTest1!");
  if (inj.status === 400) pass("malformed email rejected");
  else finding("low", "Odd email accepted", "status=" + inj.status);
}

async function testRateLimitRegister() {
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  const results = [];
  for (let i = 0; i < 12; i++) {
    const r = await req("/api/auth/register", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: {
        email: `rl-${ip.replace(/\./g, "")}-${i}@test.local`,
        username: `rl${rand()}${i}`,
        password: "StressTest1!",
      },
    });
    results.push(r.status);
  }
  const limited = results.filter((s) => s === 429).length;
  const created = results.filter((s) => s === 201).length;
  if (limited > 0) pass(`register rate-limit works (${limited}/12 blocked, ${created} created)`);
  else finding("high", "Register rate-limit ineffective", `statuses=${results.join(",")}`);

  // bypass via rotating X-Forwarded-For
  const bypass = [];
  for (let i = 0; i < 8; i++) {
    const r = await req("/api/auth/register", {
      method: "POST",
      headers: { "x-forwarded-for": `198.51.100.${i + 10}` },
      body: {
        email: `bypass-${rand()}-${i}@test.local`,
        username: `bp${rand()}${i}`,
        password: "StressTest1!",
      },
    });
    bypass.push(r.status);
  }
  const bypassOk = bypass.filter((s) => s === 201).length;
  if (bypassOk >= 6) {
    finding(
      "high",
      "Rate-limit bypass via X-Forwarded-For spoofing",
      `Created ${bypassOk}/8 accounts by rotating XFF — trust proxy config needed`,
      { statuses: bypass },
    );
  } else {
    pass("XFF rotation did not fully bypass register limit");
  }
}

async function testFormSpam(pageId) {
  if (!pageId) return;
  const ip = "198.51.100.50";
  const statuses = [];
  for (let i = 0; i < 25; i++) {
    const r = await req("/api/forms/submit", {
      method: "POST",
      headers: { "x-forwarded-for": ip, "user-agent": "StressBot/1.0" },
      body: {
        pageId,
        payload: { email: `spam${i}@evil.com`, message: "A".repeat(5000) },
      },
    });
    statuses.push(r.status);
  }
  const limited = statuses.filter((s) => s === 429).length;
  const accepted = statuses.filter((s) => s === 201).length;
  if (limited > 0) pass(`form submit rate-limit (${limited} blocked, ${accepted} accepted)`);
  else finding("high", "Form spam not rate-limited", `all statuses=${[...new Set(statuses)]}`);

  // oversized field names / payload
  const big = {};
  for (let i = 0; i < 100; i++) big["f" + i] = "x".repeat(3000);
  const r = await req("/api/forms/submit", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.51", "user-agent": "Mozilla/5.0" },
    body: { pageId, payload: big },
  });
  if (r.status === 201) {
    finding("medium", "Form accepts 100 fields without hard cap on field count", `status=201 — field names >40 stripped but volume still stored`);
  } else {
    pass(`oversized form payload status=${r.status}`);
  }
}

async function testAnalyticsFlood(pageId) {
  if (!pageId) return;
  const statuses = [];
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: 80 }, (_, i) =>
      req("/api/analytics/track", {
        method: "POST",
        headers: {
          "x-forwarded-for": `203.0.113.${(i % 50) + 1}`,
          "user-agent": "Mozilla/5.0 Chrome/120",
        },
        body: {
          type: "PAGE_VIEW",
          pageId,
          referer: "https://evil.com",
          utm: { source: "stress", campaign: "flood" },
        },
      }).then((r) => statuses.push(r.status)),
    ),
  );
  const ms = Date.now() - t0;
  const accepted = statuses.filter((s) => s === 200).length;
  const limited = statuses.filter((s) => s === 429).length;
  if (accepted > 60 && limited === 0) {
    finding(
      "medium",
      "Analytics flood: concurrent XFF rotation bypasses per-IP limit",
      `${accepted}/80 accepted in ${ms}ms — cost amplification on Redis stream`,
    );
  } else {
    pass(`analytics flood: accepted=${accepted} limited=${limited} in ${ms}ms`);
  }
}

async function testOpenRedirectShortLink(cookie) {
  // javascript: and //evil.com
  for (const url of ["javascript:alert(1)", "data:text/html,hi", "//evil.example/phish", "http://169.254.169.254/latest/meta-data/"]) {
    const r = await authed("/api/short-links", cookie, {
      method: "POST",
      body: { url },
    });
    if (r.status === 201) {
      finding(
        url.startsWith("javascript") || url.startsWith("data:") ? "high" : "medium",
        `Dangerous short-link URL accepted: ${url}`,
        `code=${r.json?.data?.code} — open redirect / XSS via shortener`,
        { shortUrl: r.json?.data?.shortUrl },
      );
      // try follow
      if (r.json?.data?.code) {
        const redir = await req(`/api/short/${r.json.data.code}`, { redirect: "manual" });
        if (redir.status >= 300 && redir.status < 400) {
          finding("high", "Short link redirects to unvalidated URL", `Location: ${redir.location}`);
        }
      }
    } else if (r.status === 400) {
      pass(`dangerous URL rejected: ${url}`);
    } else if (r.status === 403) {
      pass(`short link blocked by plan: ${url}`);
    }
  }
}

async function testDemoBillingAbuse(pageId) {
  if (!pageId) return;
  const r = await req("/api/billing/checkout-one-time", {
    method: "POST",
    headers: { "user-agent": "Mozilla/5.0" },
    body: {
      pageId,
      kind: "donation",
      amountMinor: 1,
      currency: "USD",
      title: "Abuse",
    },
  });
  if (r.status === 200 && r.json?.data?.mode === "demo") {
    finding(
      "high",
      "Demo billing enabled — fake payments can spam owner inbox",
      "FEATURE_BILLING_DEMO=true allows unlimited fake donations without money",
    );
    // complete many demos
    const token = new URL(r.json.data.url, BASE).searchParams.get("token");
    if (token) {
      let okCount = 0;
      for (let i = 0; i < 15; i++) {
        const c = await req("/api/billing/demo-complete", {
          method: "POST",
          headers: { "x-forwarded-for": "198.51.100.99", "user-agent": "Mozilla/5.0" },
          body: { token },
        });
        if (c.status === 200) okCount++;
      }
      if (okCount > 5) {
        finding(
          "high",
          "Demo payment token is reusable (no single-use / nonce)",
          `Same token completed ${okCount}/15 times — inbox flood + fake analytics`,
        );
      } else {
        pass(`demo token reuse limited (${okCount})`);
      }
    }
  } else if (r.status === 400) {
    pass("demo billing disabled or not available");
  }
}

async function testStripeWebhookNoSig() {
  const r = await req("/api/billing/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: {
      type: "customer.subscription.updated",
      data: { object: { id: "sub_fake", customer: "cus_x", status: "active", metadata: { userId: "admin" } } },
    },
  });
  if (r.status === 200) {
    finding("critical", "Stripe webhook accepts unsigned payloads", r.text.slice(0, 200));
  } else {
    pass(`unsigned Stripe webhook rejected status=${r.status}`);
  }
}

async function testInternalHostResolve() {
  const r = await req("/api/internal/resolve-host?host=evil.com");
  // should 404 if not configured, but endpoint is public
  if (r.status === 200 || r.status === 404 || r.status === 400) {
    finding(
      "low",
      "Internal resolve-host is publicly callable",
      `status=${r.status} — enables domain enumeration / cache probing`,
    );
  }
}

async function testReportsSpam() {
  const statuses = [];
  for (let i = 0; i < 15; i++) {
    const r = await req("/api/reports", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.77", "user-agent": "Mozilla/5.0" },
      body: { pageSlug: "nonexistent-xyz", reason: "spam", details: "stress" },
    });
    statuses.push(r.status);
  }
  const limited = statuses.filter((s) => s === 429).length;
  // page not found may be 404 first
  if (limited > 0) pass(`reports rate-limited (${limited})`);
  else {
    const notFound = statuses.filter((s) => s === 404).length;
    if (notFound === 15) pass("reports for missing page return 404 (no spam rows)");
    else finding("medium", "Report endpoint may allow spam", `statuses=${statuses.join(",")}`);
  }
}

async function testFreemiumRace(cookie) {
  // Try create many pages in parallel to race the free limit
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      authed("/api/pages", cookie, {
        method: "POST",
        body: { title: `Race page ${i}`, slug: `race-${rand()}-${i}` },
      }),
    ),
  );
  const created = results.filter((r) => r.status === 201).length;
  const forbidden = results.filter((r) => r.status === 403).length;
  if (created > 3) {
    finding(
      "medium",
      "Freemium page limit race condition",
      `Parallel creates: ${created} succeeded (limit 3) forbidden=${forbidden}`,
    );
  } else {
    pass(`freemium page limit holds under concurrency (created=${created})`);
  }
}

async function testXSSContent(cookie, pageId) {
  if (!pageId) return;
  const xss = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  const r = await authed(`/api/pages/${pageId}/blocks`, cookie, {
    method: "POST",
    body: { type: "TEXT", content: { text: xss } },
  });
  if (r.status === 201) {
    finding(
      "medium",
      "Stored XSS payload accepted in TEXT block (verify React escapes on render)",
      "Payload stored — confirm public renderer does not dangerouslySetInnerHTML",
    );
  }
  // LINK with javascript:
  const r2 = await authed(`/api/pages/${pageId}/blocks`, cookie, {
    method: "POST",
    body: { type: "LINK", content: { label: "Click", url: "javascript:alert(1)" } },
  });
  if (r2.status === 201) {
    finding("high", "javascript: URL allowed in LINK block", "Potential XSS when user clicks public page link");
  } else {
    pass("javascript: link rejected or not creatable");
  }
}

async function testPrivatePageExposure(cookie, pageId) {
  if (!pageId) return;
  await authed(`/api/pages/${pageId}`, cookie, {
    method: "PATCH",
    body: { isPublished: true, isPrivate: true },
  });
  // get public slug from me pages
  const pages = await authed("/api/pages", cookie);
  const page = (pages.json?.data || []).find((p) => p.id === pageId);
  if (!page) return;
  const pub = await req(`/u/${page.slug}`);
  // private pages may still be fully public — check code
  if (pub.status === 200 && pub.text.includes("password") === false) {
    finding(
      "high",
      "isPrivate=true does not gate public /u/[slug] access",
      "Private flag stored but public renderer serves page without password gate",
    );
  } else if (pub.status === 404) {
    pass("private page not publicly accessible");
  } else {
    pass(`private page status=${pub.status}`);
  }
}

async function testCouponRace() {
  // can't easily without admin cookie; note static finding about redeem-before-checkout
  finding(
    "medium",
    "Coupon redemptions++ happens before successful Stripe checkout",
    "In checkout route, coupon.redemptions increments immediately — abandoned checkouts burn coupon quota (business logic bug)",
  );
}

async function testSSRFWebhookNote() {
  finding(
    "high",
    "Webhook URLs not restricted (SSRF risk)",
    "PRO users can set webhook URL to http://169.254.169.254, http://localhost, file internals — worker fetch has no blocklist",
  );
}

async function testOpenHostHeader() {
  const r = await req("/api/billing/checkout-one-time", {
    method: "POST",
    headers: {
      host: "evil.attacker.com",
      "x-forwarded-host": "evil.attacker.com",
      "x-forwarded-proto": "https",
      "user-agent": "Mozilla/5.0",
    },
    body: {
      pageId: "nonexistent",
      kind: "product",
      amountMinor: 100,
      currency: "USD",
      title: "x",
    },
  });
  // if page not found we get 404; the vulnerable code is publicOrigin — static finding
  finding(
    "medium",
    "Host header used for Stripe success/cancel URLs (open redirect / phishing)",
    "checkout-one-time publicOrigin() trusts X-Forwarded-Host — attacker can point Stripe return to evil.com if they control a published pageId",
  );
  void r;
}

async function testForgotPasswordEnum() {
  const a = await req("/api/auth/forgot-password", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.200" },
    body: { email: "admin@linkforge.local" },
  });
  const b = await req("/api/auth/forgot-password", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.201" },
    body: { email: "nobody-does-not-exist@test.local" },
  });
  if (a.status === b.status && JSON.stringify(a.json) === JSON.stringify(b.json)) {
    pass("forgot-password does not enumerate accounts (same response)");
  } else {
    finding("low", "Possible account enumeration via forgot-password timing/body", {
      a: a.status,
      b: b.status,
    });
  }
}

async function testLoginBruteForce() {
  const statuses = [];
  for (let i = 0; i < 15; i++) {
    const r = await login("admin@linkforge.local", "wrong-password-" + i);
    statuses.push(r.status);
  }
  // NextAuth returns 200 with url error often
  pass(`login brute force attempted (statuses unique: ${[...new Set(statuses)].join(",")}) — check lockout in auth rate-limit`);
  finding(
    "medium",
    "Login rate-limit is per-email in authorize(), not hard lockout with backoff UI",
    "10 attempts / 30 capacity — credential stuffing still feasible across IPs; no CAPTCHA after N fails",
  );
}

async function stressLatency() {
  const samples = [];
  for (let i = 0; i < 30; i++) {
    const r = await req("/api/health");
    samples.push(r.ms);
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  pass(`latency health p50=${p50}ms p95=${p95}ms`);
  if (p95 > 500) finding("low", "High health latency p95", `${p95}ms`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Linkforge stress/security audit against ${BASE} ===\n`);

  await testHealth();
  await testUnauthProtected();
  await testRegistrationAbuse();
  await testRateLimitRegister();
  await testStripeWebhookNoSig();
  await testInternalHostResolve();
  await testReportsSpam();
  await testForgotPasswordEnum();
  await testLoginBruteForce();
  await testCouponRace();
  await testSSRFWebhookNote();
  await testOpenHostHeader();
  await stressLatency();

  // Create two users for IDOR
  const uA = `alice-${rand()}@test.local`;
  const uB = `bob-${rand()}@test.local`;
  const unA = `alice${rand()}`;
  const unB = `bob${rand()}`;
  const regA = await register(uA, unA);
  const regB = await register(uB, unB);
  if (regA.status !== 201) finding("info", "Could not register Alice", regA.text.slice(0, 100));
  if (regB.status !== 201) finding("info", "Could not register Bob", regB.text.slice(0, 100));

  const loginA = await login(uA);
  const loginB = await login(uB);
  if (!loginA.cookie.includes("authjs") && !loginA.cookie.includes("session")) {
    finding("info", "Login cookie may be incomplete — session tests limited", `cookie keys: ${loginA.cookie.slice(0, 80)}`);
  }

  if (loginA.ok || loginA.cookie) {
    await testAdminWithoutRole(loginA.cookie);
    await testMassAssignment(loginA.cookie);
    await testFreemiumRace(loginA.cookie);
    await testOpenRedirectShortLink(loginA.cookie);

    const pageRes = await authed("/api/pages", loginA.cookie, {
      method: "POST",
      body: { title: "Alice Public", slug: `alice-pub-${rand()}` },
    });
    let pageId = pageRes.json?.data?.id;
    if (!pageId) {
      const list = await authed("/api/pages", loginA.cookie);
      pageId = list.json?.data?.[0]?.id;
    }
    if (pageId) {
      await authed(`/api/pages/${pageId}`, loginA.cookie, {
        method: "PATCH",
        body: { isPublished: true },
      });
      if (loginB.cookie) await testIdor(loginA.cookie, loginB.cookie, pageId);
      await testFormSpam(pageId);
      await testAnalyticsFlood(pageId);
      await testDemoBillingAbuse(pageId);
      await testXSSContent(loginA.cookie, pageId);
      await testPrivatePageExposure(loginA.cookie, pageId);
    } else {
      finding("info", "No page id for Alice — skip IDOR/form tests", pageRes.text.slice(0, 120));
    }
  } else {
    finding("info", "Could not login test users — some dynamic tests skipped", String(loginA.status));
  }

  // Summary
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  console.log("\n========== SUMMARY ==========");
  console.log(`Passed checks: ${ok.length}`);
  console.log(`Findings: ${findings.length}`);
  for (const s of ["critical", "high", "medium", "low", "info"]) {
    const n = findings.filter((f) => f.severity === s).length;
    if (n) console.log(`  ${s}: ${n}`);
  }
  console.log("\n--- Findings detail ---\n");
  for (const f of findings) {
    console.log(`[${f.severity.toUpperCase()}] ${f.title}`);
    console.log(`  ${f.detail}`);
  }

  // write report
  const report = {
    base: BASE,
    at: new Date().toISOString(),
    passed: ok.length,
    findings,
  };
  const fs = await import("node:fs");
  fs.writeFileSync("stress-security-report.json", JSON.stringify(report, null, 2));
  console.log("\nWrote stress-security-report.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
