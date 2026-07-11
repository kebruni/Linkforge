import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFromHeaders } from "@/lib/geo";

export const runtime = "nodejs";

const bodySchema = z.object({
  pageId: z.string().min(1).optional(),
  pageSlug: z.string().min(1).max(64).optional(),
  reason: z.enum([
    "spam",
    "phishing",
    "hate",
    "adult",
    "copyright",
    "impersonation",
    "other",
  ]),
  details: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const ipInfo = resolveFromHeaders(new Headers(req.headers));
  const ipKey = ipInfo.ip ?? "unknown";
  const rl = await rateLimit(`reports:create:${ipKey}`, 5, 10);
  if (!rl.ok) return errors.tooMany();

  const session = await auth();
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid report", parsed.error.flatten().fieldErrors);

  let pageId = parsed.data.pageId;
  let reportedUserId: string | null = null;

  if (!pageId && parsed.data.pageSlug) {
    const page = await prisma.page.findFirst({
      where: { slug: parsed.data.pageSlug, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!page) return errors.notFound("Page not found");
    pageId = page.id;
    reportedUserId = page.userId;
  } else if (pageId) {
    const page = await prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!page) return errors.notFound("Page not found");
    reportedUserId = page.userId;
  }

  // Anonymous reporters: use a system placeholder if not logged in — ContentReport requires reporterId
  let reporterId = session?.user?.id;
  if (!reporterId) {
    // Create or reuse a dedicated anonymous system user for public reports
    const anon = await prisma.user.upsert({
      where: { email: "reports@linkforge.system" },
      create: {
        email: "reports@linkforge.system",
        username: "system-reports",
        name: "Anonymous reports",
        role: "SUPPORT",
      },
      update: {},
      select: { id: true },
    });
    reporterId = anon.id;
  }

  const report = await prisma.contentReport.create({
    data: {
      reporterId,
      reportedUserId,
      pageId: pageId ?? null,
      reason: parsed.data.reason,
      details: parsed.data.details?.trim() || null,
      status: "OPEN",
    },
    select: { id: true, status: true, createdAt: true },
  });

  return ok(
    {
      id: report.id,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      message: "Thanks — our team will review this report.",
    },
    { status: 201 },
  );
}
