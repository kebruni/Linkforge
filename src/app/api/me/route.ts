import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { isValidSlug, slugify } from "@/lib/utils";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  username: z
    .string()
    .min(3)
    .max(32)
    .refine(isValidSlug, "Invalid username")
    .optional(),
  locale: z.string().min(2).max(10).optional(),
  marketingOptIn: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      avatarUrl: true,
      role: true,
      locale: true,
      twoFactorEnabled: true,
      marketingOptIn: true,
      createdAt: true,
    },
  });
  if (!user) return errors.notFound();
  return ok(user);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`me:update:${session.user.id}`, 20, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);

  let username: string | undefined;
  if (parsed.data.username) {
    username = slugify(parsed.data.username);
    if (!isValidSlug(username)) return errors.badRequest("Invalid username");

    const reserved = await prisma.reservedSlug.findUnique({ where: { slug: username } });
    if (reserved) return errors.conflict("This username is reserved");

    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: session.user.id } },
      select: { id: true },
    });
    if (taken) return errors.conflict("Username taken");
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      username,
      locale: parsed.data.locale,
      marketingOptIn: parsed.data.marketingOptIn,
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      locale: true,
      marketingOptIn: true,
    },
  });

  return ok(user);
}
