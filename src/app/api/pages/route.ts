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

  const limit = pageLimitFor(session.user.role);
  const userId = session.user.id;
  const username = session.user.username;

  // Freemium gate under row lock — prevents concurrent create races
  let page: { id: string; slug: string; title: string };
  try {
    page = await prisma.$transaction(async (tx) => {
      // Lock user row so concurrent page creates serialize on the same account
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

      if (Number.isFinite(limit)) {
        const count = await tx.page.count({
          where: { userId, deletedAt: null },
        });
        if (count >= limit) {
          throw new Error("PAGE_LIMIT");
        }
      }

      return tx.page.create({
        data: {
          userId,
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
                  content: { title, subtitle: `@${username}` },
                },
              ],
            },
          },
        },
        select: { id: true, slug: true, title: true },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "PAGE_LIMIT") {
      return errors.forbidden(
        `Free plan allows ${limit} pages. Upgrade to PRO for unlimited pages.`,
      );
    }
    // Unique slug race
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
      return errors.conflict("Slug already taken — pick another");
    }
    throw err;
  }

  await writeAudit({
    action: "PAGE_CREATED",
    userId,
    targetId: page.id,
    meta: { slug: page.slug },
  });

  return ok(page, { status: 201 });
}
