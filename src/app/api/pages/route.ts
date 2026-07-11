import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isValidSlug, slugify } from "@/lib/utils";
import { env } from "@/lib/env";
import { pageLimitFor } from "@/lib/plan";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  title: z.string().min(1).max(160),
  // Accept free-form slug input — we normalise with slugify below
  slug: z.string().min(1).max(64).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const pages = await prisma.page.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  return ok(pages);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`pages:create:${session.user.id}`, 10, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const limit = pageLimitFor(session.user.role);
  if (Number.isFinite(limit)) {
    const count = await prisma.page.count({
      where: { userId: session.user.id, deletedAt: null },
    });
    if (count >= limit) {
      return errors.forbidden(
        `Free plan allows ${limit} pages. Upgrade to PRO for unlimited pages.`,
      );
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const title = parsed.data.title.trim();
  if (!title) return errors.badRequest("Title is required");

  // Prefer explicit slug; fall back to title so "My name's" → "my-names"
  const slug = slugify(parsed.data.slug?.trim() || title);
  if (slug.length < 3) {
    return errors.badRequest("Slug must be at least 3 characters (use letters or numbers)");
  }
  if (!isValidSlug(slug)) {
    return errors.badRequest(
      "Slug can only use lowercase letters, numbers and hyphens (e.g. my-page)",
    );
  }

  const reserved = await prisma.reservedSlug.findUnique({ where: { slug } });
  if (reserved) return errors.conflict("This slug is reserved — pick another");

  const existing = await prisma.page.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return errors.conflict("Slug already taken — pick another");

  const page = await prisma.page.create({
    data: {
      userId: session.user.id,
      title,
      slug,
      theme: {
        create: {
          presetKey: "minimal-light",
          tokens: {
            background: "#FAFAFA",
            surface: "#FFFFFF",
            text: "#0A0A0A",
            accent: "#7C3AED",
            radius: 16,
            font: "Inter",
          },
        },
      },
      blocks: {
        createMany: {
          data: [
            {
              type: "AVATAR",
              order: 0,
              content: { src: null },
            },
            {
              type: "HEADER",
              order: 1,
              content: { title, subtitle: `@${session.user.username}` },
            },
          ],
        },
      },
    },
    select: { id: true, slug: true, title: true },
  });

  await writeAudit({
    action: "PAGE_CREATED",
    userId: session.user.id,
    targetId: page.id,
    meta: { slug: page.slug },
  });

  return ok(page, { status: 201 });
}
