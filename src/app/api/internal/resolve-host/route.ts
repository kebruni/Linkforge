/**
 * Internal domain → page slug resolver (used by middleware for custom domains).
 * Cached in Redis for 60s.
 */
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";
import { normalizeDomain } from "@/lib/domains";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!env.FEATURE_CUSTOM_DOMAINS) return errors.notFound();

  const host = new URL(req.url).searchParams.get("host");
  if (!host) return errors.badRequest("host required");

  const domain = normalizeDomain(host.split(":")[0] ?? host);
  if (!domain) return errors.badRequest("invalid host");

  // Never resolve the primary app host
  try {
    const appHost = new URL(env.APP_URL).hostname.toLowerCase();
    if (domain === appHost) return errors.notFound();
  } catch {
    /* ignore */
  }

  const cacheKey = `domain:slug:${domain}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached === "null") return errors.notFound();
    if (cached) return ok({ slug: cached, domain });
  } catch {
    /* redis optional */
  }

  const row = await prisma.customDomain.findFirst({
    where: { domain, verifiedAt: { not: null } },
    select: { page: { select: { slug: true, isPublished: true, deletedAt: true } } },
  });

  if (!row?.page || row.page.deletedAt || !row.page.isPublished) {
    try {
      await redis.set(cacheKey, "null", "EX", 30);
    } catch {
      /* ignore */
    }
    return errors.notFound();
  }

  try {
    await redis.set(cacheKey, row.page.slug, "EX", 60);
  } catch {
    /* ignore */
  }

  return ok({ slug: row.page.slug, domain });
}
