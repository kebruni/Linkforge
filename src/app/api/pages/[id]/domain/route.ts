import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { canUseCustomDomains } from "@/lib/plan";
import {
  dnsHasTxt,
  isValidHostname,
  makeDomainVerifyToken,
  normalizeDomain,
} from "@/lib/domains";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  domain: z.string().min(3).max(253),
});

async function findOwnPage(id: string, userId: string) {
  return prisma.page.findFirst({
    where: { id, userId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      customDomain: {
        select: {
          id: true,
          domain: true,
          verifiedAt: true,
          txtVerifyKey: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;
  const page = await findOwnPage(id, session.user.id);
  if (!page) return errors.notFound();

  return ok({
    featureEnabled: env.FEATURE_CUSTOM_DOMAINS,
    allowed: canUseCustomDomains(session.user.role) && env.FEATURE_CUSTOM_DOMAINS,
    domain: page.customDomain
      ? {
          id: page.customDomain.id,
          domain: page.customDomain.domain,
          verifiedAt: page.customDomain.verifiedAt?.toISOString() ?? null,
          txtVerifyKey: page.customDomain.txtVerifyKey,
          createdAt: page.customDomain.createdAt.toISOString(),
        }
      : null,
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  if (!env.FEATURE_CUSTOM_DOMAINS) {
    return errors.forbidden("Custom domains are disabled on this deployment");
  }
  if (!canUseCustomDomains(session.user.role)) {
    return errors.forbidden("Custom domains require a PRO plan");
  }

  const { id } = await params;
  const page = await findOwnPage(id, session.user.id);
  if (!page) return errors.notFound();

  const rl = await rateLimit(`domain:set:${session.user.id}`, 10, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid domain");

  const domain = normalizeDomain(parsed.data.domain);
  if (!isValidHostname(domain)) {
    return errors.badRequest("Enter a valid hostname like links.example.com");
  }

  // Don't allow pointing at the main app host
  try {
    const appHost = new URL(env.APP_URL).hostname.toLowerCase();
    if (domain === appHost || domain.endsWith(`.${appHost}`)) {
      return errors.badRequest("Cannot use the app hostname as a custom domain");
    }
  } catch {
    /* ignore */
  }

  const taken = await prisma.customDomain.findFirst({
    where: { domain, pageId: { not: id } },
    select: { id: true },
  });
  if (taken) return errors.conflict("This domain is already linked to another page");

  const txtVerifyKey = makeDomainVerifyToken();
  const row = await prisma.customDomain.upsert({
    where: { pageId: id },
    create: { pageId: id, domain, txtVerifyKey },
    update: { domain, txtVerifyKey, verifiedAt: null, certIssuedAt: null, certNotAfter: null },
    select: {
      id: true,
      domain: true,
      txtVerifyKey: true,
      verifiedAt: true,
      createdAt: true,
    },
  });

  return ok({
    id: row.id,
    domain: row.domain,
    txtVerifyKey: row.txtVerifyKey,
    verifiedAt: null,
    createdAt: row.createdAt.toISOString(),
    instructions: {
      record: "TXT",
      host: `_linkforge.${row.domain}`,
      value: row.txtVerifyKey,
      altHost: row.domain,
    },
  });
}

/** Verify DNS TXT and mark domain as verified. */
export async function PUT(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  if (!env.FEATURE_CUSTOM_DOMAINS || !canUseCustomDomains(session.user.role)) {
    return errors.forbidden("Custom domains require PRO + FEATURE_CUSTOM_DOMAINS");
  }

  const { id } = await params;
  const page = await findOwnPage(id, session.user.id);
  if (!page?.customDomain) return errors.notFound("No domain configured");

  const rl = await rateLimit(`domain:verify:${session.user.id}`, 20, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const cd = page.customDomain;
  const found = await dnsHasTxt(cd.domain, cd.txtVerifyKey);
  if (!found) {
    return errors.badRequest(
      "TXT record not found yet. Add the verification record and wait for DNS propagation (up to a few minutes).",
    );
  }

  const updated = await prisma.customDomain.update({
    where: { id: cd.id },
    data: { verifiedAt: new Date() },
    select: { id: true, domain: true, verifiedAt: true },
  });

  await writeAudit({
    action: "CUSTOM_DOMAIN_VERIFIED",
    userId: session.user.id,
    targetId: page.id,
    meta: { domain: updated.domain },
  });

  return ok({
    id: updated.id,
    domain: updated.domain,
    verifiedAt: updated.verifiedAt?.toISOString() ?? null,
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;
  const page = await findOwnPage(id, session.user.id);
  if (!page) return errors.notFound();
  if (!page.customDomain) return ok({ deleted: true });

  await prisma.customDomain.delete({ where: { id: page.customDomain.id } });
  return ok({ deleted: true });
}
