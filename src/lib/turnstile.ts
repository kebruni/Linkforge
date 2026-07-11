/**
 * Cloudflare Turnstile verification (optional captcha on public forms).
 */
import { env } from "./env";
import { logger } from "./logger";

export function isTurnstileEnabled(): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

export async function verifyTurnstile(
  token: string | undefined | null,
  ip?: string | null,
): Promise<boolean> {
  if (!isTurnstileEnabled()) return true; // captcha not configured → skip
  if (!token) return false;

  try {
    const body = new URLSearchParams();
    body.set("secret", env.TURNSTILE_SECRET_KEY);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch (err) {
    logger.warn({ err }, "turnstile.verify_failed");
    return false;
  }
}
