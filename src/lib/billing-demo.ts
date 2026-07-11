/**
 * Signed tokens for demo (no-Stripe) one-time payments.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export type DemoPaymentPayload = {
  pageId: string;
  blockId: string;
  kind: "donation" | "product";
  amountMinor: number;
  currency: string;
  title: string;
  exp: number;
};

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function makeDemoToken(
  data: Omit<DemoPaymentPayload, "exp">,
  ttlMs = 30 * 60 * 1000,
): string {
  const body = Buffer.from(
    JSON.stringify({ ...data, exp: Date.now() + ttlMs }),
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
    if (!data.pageId || !data.kind || !data.amountMinor) return null;
    return data;
  } catch {
    return null;
  }
}
