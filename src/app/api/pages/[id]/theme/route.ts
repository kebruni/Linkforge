import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const tokensSchema = z.object({
  background: z.string().min(1).max(32).optional(),
  surface: z.string().min(1).max(32).optional(),
  text: z.string().min(1).max(32).optional(),
  accent: z.string().min(1).max(32).optional(),
  radius: z.number().int().min(0).max(48).optional(),
  font: z.string().max(64).optional(),
});

const bodySchema = z.object({
  tokens: tokensSchema,
  presetKey: z.string().max(64).nullable().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;

  const rl = await rateLimit(`pages:theme:${session.user.id}`, 60, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const own = await prisma.page.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    select: { id: true, theme: { select: { id: true, tokens: true } } },
  });
  if (!own) return errors.notFound();

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);

  const prev = (own.theme?.tokens as Record<string, unknown> | null) ?? {};
  const nextTokens = { ...prev, ...parsed.data.tokens } as Prisma.InputJsonValue;

  const theme = own.theme
    ? await prisma.theme.update({
        where: { pageId: id },
        data: {
          tokens: nextTokens,
          presetKey: parsed.data.presetKey === undefined ? undefined : parsed.data.presetKey,
        },
        select: { id: true, tokens: true, presetKey: true },
      })
    : await prisma.theme.create({
        data: {
          pageId: id,
          tokens: nextTokens,
          presetKey: parsed.data.presetKey ?? "minimal-light",
        },
        select: { id: true, tokens: true, presetKey: true },
      });

  await prisma.page.update({ where: { id }, data: { version: { increment: 1 } } });

  return ok(theme);
}
