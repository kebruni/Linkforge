import { z } from "zod";
import argon2 from "argon2";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";
import { dispatchUserWebhooks } from "@/lib/webhooks";

export const runtime = "nodejs";

const patchSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(500).nullable().optional(),
  isPublished: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  /** Set when enabling private mode or rotating the page password */
  pagePassword: z.string().min(4).max(128).optional().nullable(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

async function findOwn(id: string, userId: string) {
  return prisma.page.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, isPublished: true, isPrivate: true, passwordHash: true, slug: true },
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;
  const own = await findOwn(id, session.user.id);
  if (!own) return errors.notFound();

  const rl = await rateLimit(`pages:update:${session.user.id}`, 60, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);

  const wasPublished = own.isPublished;
  const willPublish = parsed.data.isPublished;
  const willPrivate = parsed.data.isPrivate;

  let passwordHash: string | null | undefined = undefined;
  if (parsed.data.pagePassword === null) {
    passwordHash = null;
  } else if (typeof parsed.data.pagePassword === "string") {
    passwordHash = await argon2.hash(parsed.data.pagePassword, { type: argon2.argon2id });
  }

  // Enabling private requires a password (new or existing)
  if (willPrivate === true) {
    const hasPw = passwordHash !== undefined ? !!passwordHash : !!own.passwordHash;
    if (!hasPw) {
      return errors.badRequest("Set pagePassword when enabling private mode");
    }
  }
  if (willPrivate === false) {
    // Clearing private also clears password
    passwordHash = null;
  }

  const page = await prisma.page.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? undefined,
      isPublished: parsed.data.isPublished,
      isPrivate: parsed.data.isPrivate,
      ...(passwordHash !== undefined ? { passwordHash } : {}),
      version: { increment: 1 },
      publishedAt:
        willPublish === true && !wasPublished
          ? new Date()
          : willPublish === false
            ? null
            : undefined,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isPublished: true,
      isPrivate: true,
      updatedAt: true,
    },
  });

  if (willPublish === true && !wasPublished) {
    await writeAudit({
      action: "PAGE_PUBLISHED",
      userId: session.user.id,
      targetId: page.id,
      meta: { slug: page.slug },
    });
    void dispatchUserWebhooks(session.user.id, "PAGE_PUBLISHED", {
      pageId: page.id,
      slug: page.slug,
      title: page.title,
      url: `${env.APP_URL}/u/${page.slug}`,
    });
  }

  return ok(page);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;
  const own = await findOwn(id, session.user.id);
  if (!own) return errors.notFound();

  await prisma.page.update({
    where: { id },
    data: { deletedAt: new Date(), isPublished: false },
  });
  return ok({ id });
}
