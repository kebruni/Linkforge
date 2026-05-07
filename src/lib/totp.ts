/**
 * Time-based One-Time Password helpers.
 *
 * Wraps `otplib` so the rest of the app deals with a tiny, intentional surface:
 *
 *   - `generateTotpSecret()`           — fresh base32 secret for enrolment
 *   - `buildTotpUri(...)`              — otpauth:// URI for QR codes
 *   - `buildTotpQrDataUrl(...)`        — pre-rendered data: QR (base64 png)
 *   - `verifyTotpCode(secret, token)`  — constant-time verify with ±1 step skew
 *
 * The secret itself is never persisted in plaintext — callers should pass it
 * through `encryptString` from `@/lib/crypto` before writing to the database.
 */
import { authenticator } from "otplib";
import qrcode from "qrcode";

import { env } from "./env";

// 30-second period (default), ±1 step window to absorb clock drift.
authenticator.options = { window: 1, step: 30, digits: 6 };

const ISSUER = env.APP_NAME || "Linkforge";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildTotpUri(secret: string, accountLabel: string): string {
  return authenticator.keyuri(accountLabel, ISSUER, secret);
}

export async function buildTotpQrDataUrl(uri: string): Promise<string> {
  return qrcode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });
}

export function verifyTotpCode(secret: string, token: string): boolean {
  if (!secret || !token) return false;
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d{6,8}$/.test(cleaned)) return false;
  try {
    return authenticator.verify({ secret, token: cleaned });
  } catch {
    return false;
  }
}
