/**
 * Custom domain helpers — DNS TXT verification.
 */
import { resolveTxt } from "node:dns/promises";
import { randomBytes } from "node:crypto";

export function makeDomainVerifyToken(): string {
  return `lf-verify=${randomBytes(16).toString("hex")}`;
}

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export function isValidHostname(domain: string): boolean {
  if (domain.length < 3 || domain.length > 253) return false;
  if (domain.includes("..") || domain.startsWith(".") || domain.endsWith(".")) return false;
  // Basic FQDN: labels of alnum/hyphen, at least one dot
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain);
}

/**
 * Check that TXT records for the domain include our verify token.
 * Also checks `_linkforge.<domain>` for cleaner setups.
 */
export async function dnsHasTxt(domain: string, expected: string): Promise<boolean> {
  const hosts = [domain, `_linkforge.${domain}`];
  for (const host of hosts) {
    try {
      const records = await resolveTxt(host);
      for (const chunks of records) {
        const value = chunks.join("");
        if (value.includes(expected)) return true;
      }
    } catch {
      // NXDOMAIN / timeout — try next host
    }
  }
  return false;
}
