/**
 * Completes a demo (no-Stripe) one-time payment: records purchase + lead.
 */
import { z } from "zod";
import { AnalyticsEventType } from "@prisma/client";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFromHeaders } from "@/lib/geo";
import { isDemoBillingEnabled } from "@/lib/stripe";
import { verifyDemoToken } from "@/lib/billing-demo";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(16),
});

export async function POST(req: Request) {
  if (!isDemoBillingEnabled()) {
    return errors.badRequest("Demo billing is disabled");
  }

  const ip = resolveFromHeaders(new Headers(req.headers)).ip ?? "unknown";
  const rl = await rateLimit(`billing:demo:${ip}`, 30, 10);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return errors.badRequest("Invalid token");

  const data = verifyDemoToken(parsed.data.token);
  if (!data) return errors.badRequest("Invalid or expired payment session");

  const page = await prisma.page.findFirst({
    where: { id: data.pageId, deletedAt: null },
    select: { id: true, slug: true, userId: true, title: true },
  });
  if (!page) return errors.notFound("Page not found");

  const amountDisplay = (data.amountMinor / 100).toFixed(2);

  // Inbox for page owner
  await prisma.formSubmission.create({
    data: {
      pageId: page.id,
      blockId: data.blockId || null,
      ownerId: page.userId,
      payload: {
        kind: data.kind,
        title: data.title,
        amount: amountDisplay,
        amountMinor: data.amountMinor,
        currency: data.currency,
        mode: "demo",
        message:
          data.kind === "donation"
            ? `Demo donation of ${data.currency} ${amountDisplay}`
            : `Demo purchase: ${data.title} (${data.currency} ${amountDisplay})`,
      },
      ip,
      score: 100,
    },
  });

  // Analytics event
  await prisma.analyticsEvent.create({
    data: {
      pageId: page.id,
      blockId: data.blockId || null,
      ownerId: page.userId,
      type: AnalyticsEventType.PRODUCT_PURCHASE,
      meta: {
        kind: data.kind,
        amountMinor: data.amountMinor,
        currency: data.currency,
        title: data.title,
        mode: "demo",
      },
    },
  });

  logger.info(
    { pageId: page.id, kind: data.kind, amountMinor: data.amountMinor },
    "billing.demo.completed",
  );

  return ok({
    redirect: `/u/${page.slug}?paid=1&kind=${data.kind}&amount=${amountDisplay}&currency=${data.currency}&demo=1`,
  });
}
