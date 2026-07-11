/**
 * Signed tokens for demo (no-Stripe) one-time payments.
 * Tokens are single-use (consumed in Redis after first successful complete).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { redis } from "./redis";
import { sha256Hex } from "./crypto";

export type DemoPaymentPayload = {
  pageId: string;
  blockId: string;
  kind: "donation" | "product";
  amountMinor: number;
  currency: string;
  title: string;
  exp: number;
  jti: string;
};

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function makeDemoToken(
  data: Omit<DemoPaymentPayload, "exp" | "jti">,
  ttlMs = 30 * 60 * 1000,
): string {
  const body = Buffer.from(
    JSON.stringify({
      ...data,
      jti: randomBytes(12).toString("base64url"),
      exp: Date.now() + ttlMs,
    }),
    "utf8",
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyDemoToken(token: string): DemoPaymentPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DemoPaymentPayload;
    if (!data.exp || data.exp < Date.now()) return null;
    if (!data.pageId || !data.kind || !data.amountMinor || !data.jti) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Atomically mark a demo token as consumed. Returns false if already used.
 */
export async function consumeDemoToken(token: string, data: DemoPaymentPayload): Promise<boolean> {
  const key = `demo:pay:${data.jti || sha256Hex(token).slice(0, 32)}`;
  const ttlSec = Math.max(60, Math.ceil((data.exp - Date.now()) / 1000) + 60);
  // SET NX — only first complete wins
  const res = await redis.set(key, "1", "EX", ttlSec, "NX");
  return res === "OK";
}
