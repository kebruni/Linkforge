/**
 * One-time Stripe Checkout for donation / product blocks on public pages.
 */
import { z } from "zod";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFromHeaders } from "@/lib/geo";
import { requireStripe, BillingNotConfiguredError } from "@/lib/stripe";
import { appUrl } from "@/lib/email";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const bodySchema = z.object({
  pageId: z.string().min(1),
  blockId: z.string().min(1).optional(),
  kind: z.enum(["donation", "product"]),
  amountMinor: z.number().int().positive().max(10_000_000),
  currency: z.string().length(3).default("USD"),
  title: z.string().min(1).max(120).default("Payment"),
});

export async function POST(req: Request) {
  if (!env.FEATURE_BILLING) {
    return errors.badRequest("Billing is not enabled");
  }

  const ip = resolveFromHeaders(new Headers(req.headers)).ip ?? "unknown";
  const rl = await rateLimit(`billing:onetime:${ip}`, 20, 10);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  let stripe;
  try {
    stripe = requireStripe();
  } catch (e) {
    if (e instanceof BillingNotConfiguredError) {
      return errors.badRequest("Payments are not configured");
    }
    throw e;
  }

  const page = await prisma.page.findFirst({
    where: { id: parsed.data.pageId, deletedAt: null, isPublished: true },
    select: { id: true, slug: true, title: true, userId: true },
  });
  if (!page) return errors.notFound("Page not found");

  const currency = parsed.data.currency.toLowerCase();
  const unitAmount =
    parsed.data.kind === "donation"
      ? // donation amounts in the builder are whole currency units
        parsed.data.amountMinor * 100
      : parsed.data.amountMinor;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: parsed.data.title,
            description: `${parsed.data.kind} · ${page.title}`,
          },
        },
      },
    ],
    success_url: appUrl(`/u/${page.slug}?paid=1`),
    cancel_url: appUrl(`/u/${page.slug}?paid=0`),
    metadata: {
      pageId: page.id,
      ownerId: page.userId,
      blockId: parsed.data.blockId ?? "",
      kind: parsed.data.kind,
    },
  });

  return ok({ url: session.url });
}
