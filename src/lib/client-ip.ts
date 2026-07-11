/**
 * Resolve client IP for rate-limiting.
 *
 * Only trust X-Forwarded-For / CF headers when TRUST_PROXY=true (behind Nginx).
 * Otherwise use a single remote-ish header only if present, else "local".
 * This prevents rate-limit bypass via spoofed X-Forwarded-For in direct mode.
 */
import { env } from "./env";

export function clientIp(headers: Headers, fallback = "local"): string {
  if (env.TRUST_PROXY) {
    const cf = headers.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
    const real = headers.get("x-real-ip")?.trim();
    if (real) return real;
    // Left-most is original client when proxy appends correctly
    const xff = headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  // Untrusted: ignore client-supplied forwarding headers
  return fallback;
}
