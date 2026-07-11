/**
 * API-level end-to-end smoke (no browser).
 * Requires: app on BASE_URL, Postgres, Redis.
 *
 *   pnpm e2e:smoke
 *   BASE_URL=http://127.0.0.1:3000 pnpm e2e:smoke
 */
import { randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
let failed = 0;

function ok(name) {
  console.log(`  ✓ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`);
}

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  let body = opts.body;
  if (body && typeof body === "object" && !(body instanceof URLSearchParams)) {
    headers["content-type"] = headers["content-type"] || "application/json";
    body = JSON.stringify(body);
  }
  const res = await fetch(path.startsWith("http") ? path : `${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body,
    redirect: opts.redirect || "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text, headers: res.headers, location: res.headers.get("location") };
}

async function login(email, password) {
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
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: [...jar.values()].join("; "),
      "x-auth-return-redirect": "1",
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE}/dashboard`,
      json: "true",
      redirect: "false",
    }),
    redirect: "manual",
  });
  absorb(res);
  return {
    cookie: [...jar.values()].join("; "),
    ok: jar.has("authjs.session-token") || jar.has("__Secure-authjs.session-token"),
  };
}

function rand() {
  return randomBytes(4).toString("hex");
}

async function main() {
  console.log(`\nLinkforge e2e smoke → ${BASE}\n`);

  // Health
  {
    const r = await req("/api/health");
    if (r.status === 200 && r.json?.ok !== false) ok("health");
    else fail("health", `status=${r.status}`);
  }

  // Marketing
  {
    const r = await req("/");
    if (r.status === 200 && /Linkforge/i.test(r.text)) ok("marketing home");
    else fail("marketing home", `status=${r.status}`);
  }

  const email = `e2e-${rand()}@test.local`;
  const username = `e2e${rand()}`;
  const password = "StressTest1!";
  const slug = `e2e-page-${rand()}`;

  // Register
  {
    const r = await req("/api/auth/register", {
      method: "POST",
      body: { email, username, password, name: "E2E" },
    });
    if (r.status === 201) ok("register");
    else fail("register", r.text.slice(0, 120));
  }

  // Login
  const session = await login(email, password);
  if (session.ok) ok("login session cookie");
  else fail("login session cookie");

  const authed = (path, opts = {}) =>
    req(path, { ...opts, headers: { ...(opts.headers || {}), cookie: session.cookie } });

  // Me
  {
    const r = await authed("/api/me");
    if (r.status === 200 && r.json?.data?.email === email) ok("GET /api/me");
    else fail("GET /api/me", `status=${r.status}`);
  }

  // Create + publish page
  let pageId;
  {
    const r = await authed("/api/pages", {
      method: "POST",
      body: { title: "E2E Page", slug },
    });
    if (r.status === 201 && r.json?.data?.id) {
      pageId = r.json.data.id;
      ok("create page");
    } else fail("create page", r.text.slice(0, 120));
  }

  if (pageId) {
    const r = await authed(`/api/pages/${pageId}`, {
      method: "PATCH",
      body: { isPublished: true, description: "e2e public" },
    });
    if (r.status === 200 && r.json?.data?.isPublished) ok("publish page");
    else fail("publish page", r.text.slice(0, 120));
  }

  // Public renderer
  {
    const r = await req(`/u/${slug}`);
    if (r.status === 200 && /E2E Page/i.test(r.text)) ok("public page render");
    else fail("public page render", `status=${r.status}`);
  }

  // Analytics track
  if (pageId) {
    const r = await req("/api/analytics/track", {
      method: "POST",
      headers: { "user-agent": "Mozilla/5.0 E2E" },
      body: { type: "PAGE_VIEW", pageId, referer: null },
    });
    if (r.status === 200) ok("analytics track");
    else fail("analytics track", `status=${r.status}`);
  }

  // Form submit
  if (pageId) {
    const r = await req("/api/forms/submit", {
      method: "POST",
      headers: { "user-agent": "Mozilla/5.0 E2E" },
      body: { pageId, payload: { email: "lead@example.com", message: "hi e2e" } },
    });
    if (r.status === 201) ok("form submit");
    else fail("form submit", r.text.slice(0, 120));
  }

  // Security: reject javascript short link
  {
    const r = await authed("/api/short-links", {
      method: "POST",
      body: { url: "javascript:alert(1)" },
    });
    if (r.status === 400) ok("reject javascript short link");
    else fail("reject javascript short link", `status=${r.status}`);
  }

  // Security: reject metadata short link
  {
    const r = await authed("/api/short-links", {
      method: "POST",
      body: { url: "http://169.254.169.254/" },
    });
    if (r.status === 400) ok("reject metadata short link");
    else fail("reject metadata short link", `status=${r.status}`);
  }

  // Safe short link
  {
    const r = await authed("/api/short-links", {
      method: "POST",
      body: { url: "https://example.com/e2e" },
    });
    if (r.status === 201 && r.json?.data?.code) {
      const code = r.json.data.code;
      const redir = await req(`/api/short/${code}`);
      if (redir.status >= 300 && redir.status < 400 && (redir.location || "").includes("example.com")) {
        ok("short link redirect https");
      } else fail("short link redirect https", `status=${redir.status} loc=${redir.location}`);
    } else fail("create safe short link", `status=${r.status}`);
  }

  // Private page gate
  if (pageId) {
    const r = await authed(`/api/pages/${pageId}`, {
      method: "PATCH",
      body: { isPrivate: true, pagePassword: "gate1234", isPublished: true },
    });
    if (r.status === 200) {
      const pub = await req(`/u/${slug}`);
      if (/Private page|password-protected|Unlock/i.test(pub.text)) ok("private page gate UI");
      else fail("private page gate UI", "gate text missing");
    } else fail("enable private page", r.text.slice(0, 120));
  }

  // Admin blocked for normal user
  {
    const r = await authed("/api/admin/reports");
    if (r.status === 403) ok("admin forbidden for user");
    else fail("admin forbidden for user", `status=${r.status}`);
  }

  // Unauth blocked
  {
    const r = await req("/api/pages");
    if (r.status === 401) ok("unauth pages blocked");
    else fail("unauth pages blocked", `status=${r.status}`);
  }

  console.log(failed === 0 ? "\nAll smoke checks passed.\n" : `\n${failed} smoke check(s) failed.\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
