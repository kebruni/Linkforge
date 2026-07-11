import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function unlockCookieName(pageId: string) {
  const h = createHash("sha256").update(pageId).digest("hex").slice(0, 16);
  return `lf_unlock_${h}`;
}

export function makeUnlockToken(pageId: string): string {
  return createHash("sha256")
    .update(`${pageId}:${env.AUTH_SECRET}:unlock`)
    .digest("base64url");
}

export function verifyUnlockToken(pageId: string, token: string | undefined): boolean {
  if (!token) return false;
  const expected = makeUnlockToken(pageId);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
