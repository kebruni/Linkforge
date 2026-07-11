import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { assertSafePublicUrl, sanitizeBlockContentUrls } from "@/lib/url-safety";

export const runtime = "nodejs";

const patchSchema = z.object({
  label: z.string().max(120).nullable().optional(),
  url: z.string().max(2048).nullable().optional(),
  hidden: z.boolean().optional(),
  content: z.record(z.unknown()).optional(),
});

interface Ctx {
  params: Promise<{ id: string; blockId: string }>;
}

async function ownPage(pageId: string, userId: string) {
  return prisma.page.findFirst({
    where: { id: pageId, userId, deletedAt: null },
    select: { id: true },
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id, blockId } = await params;

  const rl = await rateLimit(`blocks:update:${session.user.id}`, 240, env.RATE_LIMIT_WRITES_PER_MIN * 4);
  if (!rl.ok) return errors.tooMany();

  const own = await ownPage(id, session.user.id);
  if (!own) return errors.notFound();

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);

  let nextUrl = parsed.data.url;
  if (typeof nextUrl === "string" && nextUrl.length > 0) {
    const safe = assertSafePublicUrl(nextUrl, { allowMailto: true });
    if (!safe.ok) return errors.badRequest(safe.reason);
    nextUrl = safe.url;
  }

  let nextContent = parsed.data.content;
  if (nextContent) {
    const sanitized = sanitizeBlockContentUrls(nextContent);
    if (!sanitized.ok) return errors.badRequest(sanitized.reason);
    nextContent = sanitized.content;
  }

  const block = await prisma.block.update({
    where: { id: blockId },
    data: {
      label: parsed.data.label === null ? null : parsed.data.label,
      url: nextUrl === null ? null : nextUrl,
      hidden: parsed.data.hidden,
      content: nextContent as never,
    },
    select: {
      id: true,
      type: true,
      order: true,
      hidden: true,
      label: true,
      url: true,
      content: true,
    },
  });

  await prisma.page.update({ where: { id }, data: { version: { increment: 1 } } });
  return ok(block);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id, blockId } = await params;

  const own = await ownPage(id, session.user.id);
  if (!own) return errors.notFound();

  await prisma.block.update({
    where: { id: blockId },
    data: { deletedAt: new Date() },
  });
  await prisma.page.update({ where: { id }, data: { version: { increment: 1 } } });
  return ok({ id: blockId });
}
