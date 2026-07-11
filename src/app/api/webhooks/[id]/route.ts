import { z } from "zod";
import { WebhookEventType } from "@prisma/client";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  url: z.string().url().max(500).optional(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1).max(10).optional(),
  active: z.boolean().optional(),
});

async function findOwn(id: string, userId: string) {
  return prisma.webhook.findFirst({ where: { id, userId }, select: { id: true } });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;
  const own = await findOwn(id, session.user.id);
  if (!own) return errors.notFound();

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);

  const row = await prisma.webhook.update({
    where: { id },
    data: {
      url: parsed.data.url,
      events: parsed.data.events,
      active: parsed.data.active,
      // reset failures when re-enabled
      ...(parsed.data.active === true ? { failureCount: 0, lastErrorAt: null } : {}),
    },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      failureCount: true,
      updatedAt: true,
    },
  });
  return ok({ ...row, updatedAt: row.updatedAt.toISOString() });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;
  const own = await findOwn(id, session.user.id);
  if (!own) return errors.notFound();
  await prisma.webhook.delete({ where: { id } });
  return ok({ id, deleted: true });
}
