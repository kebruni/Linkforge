import { z } from "zod";

import { errors, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";
import { resolveFromHeaders, isLikelyBot } from "@/lib/geo";
import { sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { clientIp } from "@/lib/client-ip";

export const runtime = "nodejs";

const STREAM_KEY = "analytics:stream";

const schema = z.object({
  type: z.enum(["PAGE_VIEW", "BLOCK_CLICK", "FORM_SUBMIT"]),
  pageId: z.string().min(1),
  blockId: z.string().min(1).optional(),
  referer: z.string().max(500).nullable().optional(),
  utm: z
    .object({
      source: z.string().max(100).optional(),
      medium: z.string().max(100).optional(),
      campaign: z.string().max(100).optional(),
      term: z.string().max(100).optional(),
      content: z.string().max(100).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const headers = new Headers(req.headers);
  const geo = resolveFromHeaders(headers);

  if (isLikelyBot(geo.userAgent)) {
    return ok({ ignored: true });
  }

  const ipKey = clientIp(headers);
  // Global soft cap + per-IP (when TRUST_PROXY) to resist XFF rotation floods
  const [rlIp, rlGlobal] = await Promise.all([
    rateLimit(`track:${ipKey}`, 40, env.RATE_LIMIT_PUBLIC_VIEWS_PER_MIN),
    rateLimit(`track:global`, 2000, 6000),
  ]);
  if (!rlIp.ok || !rlGlobal.ok) return errors.tooMany();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid event");

  // Anonymous visitor id from trusted IP only (never spoofed XFF when TRUST_PROXY=false)
  const trustedIp = ipKey !== "local" ? ipKey : null;
  const visitorId = trustedIp
    ? sha256Hex(`${trustedIp}:${new Date().toISOString().slice(0, 10)}`).slice(0, 16)
    : null;

  const payload = {
    ts: Date.now(),
    type: parsed.data.type,
    pageId: parsed.data.pageId,
    blockId: parsed.data.blockId ?? "",
    visitorId: visitorId ?? "",
    ipHash: trustedIp ? sha256Hex(trustedIp) : "",
    country: geo.country,
    device: geo.device,
    os: geo.os,
    browser: geo.browser,
    referer: parsed.data.referer ?? "",
    utmSource: parsed.data.utm?.source ?? "",
    utmMedium: parsed.data.utm?.medium ?? "",
    utmCampaign: parsed.data.utm?.campaign ?? "",
    utmTerm: parsed.data.utm?.term ?? "",
    utmContent: parsed.data.utm?.content ?? "",
  };

  // Push to Redis stream (worker drains it into AnalyticsEvent rows + daily roll-ups)
  try {
    const args: string[] = [];
    for (const [k, v] of Object.entries(payload)) {
      args.push(k, String(v));
    }
    await redis.xadd(STREAM_KEY, "MAXLEN", "~", "100000", "*", ...args);
  } catch (err) {
    logger.error({ err }, "analytics.track.xadd_failed");
  }

  return ok({ accepted: true });
}
