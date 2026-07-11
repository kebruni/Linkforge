/**
 * API key generation + verification (lf_live_… format).
 */
import { randomBytes } from "node:crypto";
import { sha256Hex } from "./crypto";

const PREFIX_LEN = 8;

export function generateApiKey(): { raw: string; prefix: string; keyHash: string } {
  const secret = randomBytes(24).toString("base64url");
  const raw = `lf_live_${secret}`;
  const prefix = raw.slice(0, 8 + PREFIX_LEN); // "lf_live_" + 8
  return { raw, prefix, keyHash: sha256Hex(raw) };
}

export function hashApiKey(raw: string): string {
  return sha256Hex(raw);
}

export function extractBearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}
