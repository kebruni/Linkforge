import { z } from "zod";
import { AnalyticsEventType } from "@prisma/client";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFromHeaders } from "@/lib/geo";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  pageId: z.string().min(1),
  blockId: z.string().min(1).optional(),
  payload: z.record(z.unknown()),
});

export async function POST(req: Request) {
  const ipInfo = resolveFromHeaders(new Headers(req.headers));
  const ipKey = ipInfo.ip ?? "unknown";

  const rl = await rateLimit(`forms:submit:${ipKey}`, 10, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const { pageId, blockId, payload } = parsed.data;

  const page = await prisma.page.findFirst({
    where: { id: pageId, isPublished: true, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!page) return errors.notFound("Page not found");

  if (blockId) {
    const block = await prisma.block.findFirst({
      where: { id: blockId, pageId, type: "FORM", deletedAt: null, hidden: false },
      select: { id: true },
    });
    if (!block) return errors.notFound("Form not found");
  }

  // Strip oversized / non-string values for safety
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (typeof k !== "string" || k.length > 40) continue;
    if (typeof v === "string") clean[k] = v.slice(0, 2000);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) clean[k] = v;
  }

  const submission = await prisma.formSubmission.create({
    data: {
      pageId: page.id,
      blockId: blockId ?? null,
      ownerId: page.userId,
      payload: clean,
      ip: ipInfo.ip ?? null,
      country: ipInfo.country ?? null,
      userAgent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    },
    select: { id: true },
  });

  // Fire-and-forget analytics row + daily rollup bump
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  try {
    await Promise.all([
      prisma.analyticsEvent.create({
        data: {
          pageId: page.id,
          blockId: blockId ?? null,
          ownerId: page.userId,
          type: AnalyticsEventType.FORM_SUBMIT,
          country: ipInfo.country ?? null,
          meta: { submissionId: submission.id },
        },
      }),
      prisma.analyticsDaily.upsert({
        where: { pageId_day: { pageId: page.id, day } },
        create: {
          pageId: page.id,
          ownerId: page.userId,
          day,
          formSubmits: 1,
        },
        update: { formSubmits: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    logger.warn({ err, pageId }, "forms.submit.analytics_failed");
  }

  return ok({ id: submission.id }, { status: 201 });
}
