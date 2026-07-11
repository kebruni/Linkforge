import { cookies } from "next/headers";
import { z } from "zod";
import argon2 from "argon2";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { env } from "@/lib/env";
import { makeUnlockToken, unlockCookieName } from "@/lib/page-unlock";

export const runtime = "nodejs";

const bodySchema = z.object({
  pageId: z.string().min(1),
  password: z.string().min(1).max(256),
});

export async function POST(req: Request) {
  const ip = clientIp(new Headers(req.headers));
  const rl = await rateLimit(`pages:unlock:${ip}`, 10, 10);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return errors.badRequest("Invalid input");

  const page = await prisma.page.findFirst({
    where: {
      id: parsed.data.pageId,
      isPublished: true,
      isPrivate: true,
      deletedAt: null,
    },
    select: { id: true, passwordHash: true },
  });
  if (!page?.passwordHash) return errors.notFound("Page not found");

  const okPw = await argon2.verify(page.passwordHash, parsed.data.password);
  if (!okPw) return errors.forbidden("Incorrect password");

  const token = makeUnlockToken(page.id);
  const jar = await cookies();
  jar.set(unlockCookieName(page.id), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return ok({ unlocked: true });
}
