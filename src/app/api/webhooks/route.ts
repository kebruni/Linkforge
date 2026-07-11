import { z } from "zod";
import { randomBytes } from "node:crypto";
import { WebhookEventType } from "@prisma/client";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { webhookLimitFor } from "@/lib/plan";
import { env } from "@/lib/env";
import { assertSafeWebhookUrl } from "@/lib/url-safety";

export const runtime = "nodejs";

const ALL_EVENTS = Object.values(WebhookEventType);

const createSchema = z.object({
  url: z.string().min(1).max(500),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1).max(10),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const hooks = await prisma.webhook.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      failureCount: true,
      lastErrorAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return ok(
    hooks.map((h) => ({
      ...h,
      lastErrorAt: h.lastErrorAt?.toISOString() ?? null,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const limit = webhookLimitFor(session.user.role);
  if (limit === 0) {
    return errors.forbidden("Webhooks require a PRO plan. Upgrade in Settings → Billing.");
  }

  const rl = await rateLimit(`webhooks:create:${session.user.id}`, 10, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);

  const safeUrl = assertSafeWebhookUrl(parsed.data.url);
  if (!safeUrl.ok) return errors.badRequest(safeUrl.reason);

  const count = await prisma.webhook.count({ where: { userId: session.user.id } });
  if (count >= limit) {
    return errors.forbidden(`Webhook limit reached (${limit}).`);
  }

  const secret = randomBytes(24).toString("base64url");
  const row = await prisma.webhook.create({
    data: {
      userId: session.user.id,
      url: safeUrl.url,
      secret,
      events: parsed.data.events,
    },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      secret: true,
      createdAt: true,
    },
  });

  return ok(
    {
      id: row.id,
      url: row.url,
      events: row.events,
      active: row.active,
      secret: row.secret,
      createdAt: row.createdAt.toISOString(),
      availableEvents: ALL_EVENTS,
    },
    { status: 201 },
  );
}
