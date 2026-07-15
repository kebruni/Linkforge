/**
 * Client-safe URL sanitiser (no Node-only imports).
 *
 * `safeHref` is the render-time defence-in-depth for href attributes in block
 * renderers. It blocks XSS schemes (javascript:, data:, ...) and obvious
 * private/internal hostnames. The authoritative SSRF / private-IP check runs
 * server-side in `url-safety.ts` (which uses `node:net`); this lightweight
 * version keeps client bundles free of Node-only modules.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost"];

const DANGEROUS_SCHEMES = ["javascript:", "data:", "vbscript:", "file:", "blob:"];

/** Simple private/reserved IPv4 detection (pure JS, defence-in-depth). */
function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (Number(m[1]) > 255 || Number(m[2]) > 255 || Number(m[3]) > 255 || Number(m[4]) > 255) {
    return false;
  }
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function hostLiteBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => h.endsWith(s))) return true;
  if (isPrivateIPv4(h)) return true;
  // Raw IPv6 literals (contain ':') are unusual in public link hrefs; block
  // them here as defence-in-depth. Public IPv6 links are rare and the strict
  // check lives server-side in url-safety.ts.
  if (h.includes(":")) return true;
  return false;
}

/** Sanitize href for render-time defence-in-depth (never trust stored data). */
export function safeHref(raw: string | null | undefined, fallback = "#"): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();
  if (DANGEROUS_SCHEMES.some((s) => lower.startsWith(s))) return fallback;

  if (lower.startsWith("mailto:")) {
    const addr = trimmed.slice(7).split("?")[0] ?? "";
    if (!addr || addr.length > 254 || /[\s<>]/.test(addr)) return fallback;
    return trimmed;
  }

  const candidate = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return fallback;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fallback;
  if (!parsed.hostname) return fallback;
  if (hostLiteBlocked(parsed.hostname)) return fallback;

  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}
