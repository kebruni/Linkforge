import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { generateApiKey } from "@/lib/api-keys";
import { apiKeyLimitFor } from "@/lib/plan";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  scopes: z.array(z.string().min(1).max(40)).max(20).default(["pages:read", "analytics:read"]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return ok(
    keys.map((k) => ({
      ...k,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const limit = apiKeyLimitFor(session.user.role);
  if (limit === 0) {
    return errors.forbidden("API keys require a PRO plan. Upgrade in Settings → Billing.");
  }

  const rl = await rateLimit(`apikeys:create:${session.user.id}`, 10, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);

  const count = await prisma.apiKey.count({
    where: { userId: session.user.id, revokedAt: null },
  });
  if (count >= limit) {
    return errors.forbidden(`API key limit reached (${limit}). Revoke an unused key first.`);
  }

  const { raw, prefix, keyHash } = generateApiKey();
  const row = await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name.trim(),
      prefix,
      keyHash,
      scopes: parsed.data.scopes,
    },
    select: { id: true, name: true, prefix: true, scopes: true, createdAt: true },
  });

  await writeAudit({
    action: "ADMIN_ACTION",
    userId: session.user.id,
    targetId: row.id,
    meta: { kind: "API_KEY_CREATED", name: row.name },
  });

  // Raw key returned once only
  return ok(
    {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes,
      createdAt: row.createdAt.toISOString(),
      key: raw,
    },
    { status: 201 },
  );
}
