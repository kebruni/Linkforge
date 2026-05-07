/**
 * Recovery codes for 2FA fallback.
 *
 * Each code is a single-use, ~50-bit string (10 lowercase base32 chars), shown
 * to the user *once* during enrolment / regeneration.  We persist only the
 * SHA-256 hash so a database leak does not compromise the codes.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";

import { sha256Hex } from "./crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no l/i/o/0/1
const CODE_LEN = 10;
const DEFAULT_COUNT = 10;

function generateCode(): string {
  const buf = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i += 1) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  // Format as XXXXX-XXXXX for readability.
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export interface GeneratedRecoveryCodes {
  /** Plaintext codes — show to the user exactly once, never persist. */
  plain: string[];
  /** Server-side hashes — safe to persist to the DB. */
  hashes: string[];
}

export function generateRecoveryCodes(count = DEFAULT_COUNT): GeneratedRecoveryCodes {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const code = generateCode();
    plain.push(code);
    hashes.push(sha256Hex(normalize(code)));
  }
  return { plain, hashes };
}

export function normalize(code: string): string {
  return code.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function hashRecoveryCode(code: string): string {
  return sha256Hex(normalize(code));
}

/**
 * Constant-time comparison of two equal-length hex strings.  Returns false on
 * length mismatch instead of throwing.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
