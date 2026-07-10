import { randomBytes } from "node:crypto";
import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function generateCode(len = 7) {
  return randomBytes(len).toString("base64url").slice(0, len);
}

const createSchema = z.object({
  url: z.string().url().max(2048),
  pageId: z.string().optional(),
  code: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const links = await prisma.shortLink.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      code: true,
      url: true,
      hits: true,
      pageId: true,
      createdAt: true,
    },
  });

  return ok({
    links: links.map((l) => ({
      ...l,
      shortUrl: `${env.APP_URL.replace(/\/$/, "")}/api/short/${l.code}`,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`short:create:${session.user.id}`, 30, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.pageId) {
    const page = await prisma.page.findFirst({
      where: { id: parsed.data.pageId, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });
    if (!page) return errors.badRequest("Page not found");
  }

  let code = parsed.data.code ?? generateCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.shortLink.findUnique({ where: { code }, select: { id: true } });
    if (!exists) break;
    if (parsed.data.code) return errors.conflict("Code already taken");
    code = generateCode();
  }

  const link = await prisma.shortLink.create({
    data: {
      code,
      url: parsed.data.url,
      userId: session.user.id,
      pageId: parsed.data.pageId,
    },
    select: {
      id: true,
      code: true,
      url: true,
      hits: true,
      pageId: true,
      createdAt: true,
    },
  });

  return ok(
    {
      ...link,
      shortUrl: `${env.APP_URL.replace(/\/$/, "")}/api/short/${link.code}`,
    },
    { status: 201 },
  );
}
