/**
 * URL allowlists + SSRF protections for user-supplied links / webhooks.
 *
 * Server-only module: uses `node:net` for accurate IP literal detection.
 * Client-facing render-time sanitising lives in `safe-href.ts` (pure JS) so
 * `node:net` never enters the client bundle.
 */
import { isIP } from "node:net";

export { safeHref } from "./safe-href";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

/** Hosts that resolve to cloud metadata or loopback-ish names */
const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost"];

export type UrlCheckResult = { ok: true; url: string } | { ok: false; reason: string };

function isPrivateOrReservedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 0) return true; // "this" network
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80")) return true; // link-local
    // IPv4-mapped
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice(7);
      if (isIP(mapped) === 4) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }
  return true;
}

function hostBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => h.endsWith(s))) return true;
  if (isIP(h) && isPrivateOrReservedIp(h)) return true;
  return false;
}

/**
 * Safe public navigation URL (links, buttons, short links).
 * Allows http(s) only; optional mailto for blocks via allowMailto.
 */
export function assertSafePublicUrl(
  raw: string,
  opts: { allowMailto?: boolean; maxLength?: number } = {},
): UrlCheckResult {
  const maxLength = opts.maxLength ?? 2048;
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "URL is empty" };
  if (trimmed.length > maxLength) return { ok: false, reason: "URL is too long" };

  // Block obvious XSS schemes early
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:") ||
    lower.startsWith("blob:")
  ) {
    return { ok: false, reason: "URL scheme is not allowed" };
  }

  if (opts.allowMailto && lower.startsWith("mailto:")) {
    // basic mailto:addr validation
    const addr = trimmed.slice(7).split("?")[0] ?? "";
    if (!addr || addr.length > 254 || /[\s<>]/.test(addr)) {
      return { ok: false, reason: "Invalid mailto address" };
    }
    return { ok: true, url: trimmed };
  }

  // Protocol-relative → force https
  const candidate = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }

  if (!parsed.hostname) return { ok: false, reason: "URL host is required" };
  if (hostBlocked(parsed.hostname)) {
    return { ok: false, reason: "URL host is not allowed" };
  }

  // Strip credentials
  parsed.username = "";
  parsed.password = "";

  return { ok: true, url: parsed.toString() };
}

/**
 * Outbound webhook endpoints — https preferred; block private networks / metadata.
 */
export function assertSafeWebhookUrl(raw: string): UrlCheckResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "URL is empty" };
  if (trimmed.length > 500) return { ok: false, reason: "URL is too long" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "Webhook URL must be http(s)" };
  }

  // In production prefer https only
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Webhook URL must use HTTPS in production" };
  }

  if (!parsed.hostname) return { ok: false, reason: "URL host is required" };
  if (hostBlocked(parsed.hostname)) {
    return { ok: false, reason: "Webhook host is not allowed (private/internal)" };
  }

  parsed.username = "";
  parsed.password = "";
  return { ok: true, url: parsed.toString() };
}

/** Extract URL field from block content and validate known link-like keys. */
export function sanitizeBlockContentUrls(
  content: Record<string, unknown>,
): { ok: true; content: Record<string, unknown> } | { ok: false; reason: string } {
  const next = { ...content };
  for (const key of ["url", "src", "href"] as const) {
    const v = next[key];
    if (typeof v !== "string" || !v.trim()) continue;
    // image src may be empty during edit; allow empty
    if (key === "src" && !v.trim()) continue;
    // relative paths / empty skip for images that use uploads later
    if (key === "src" && v.startsWith("/")) continue;
    if (key === "src" && v.startsWith("data:image/")) {
      // disallow data: for now (large + XSS surface)
      return { ok: false, reason: "data: image URLs are not allowed" };
    }
    const check = assertSafePublicUrl(v, { allowMailto: key === "url" });
    if (!check.ok) return { ok: false, reason: `${key}: ${check.reason}` };
    next[key] = check.url;
  }
  return { ok: true, content: next };
}
