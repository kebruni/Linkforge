/**
 * One-time checkout for donation / product blocks on public pages.
 * Uses Stripe when keys are set; otherwise demo checkout (FEATURE_BILLING_DEMO / dev).
 */
import { z } from "zod";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFromHeaders } from "@/lib/geo";
import {
  getStripe,
  isBillingConfigured,
  isDemoBillingEnabled,
} from "@/lib/stripe";
import { makeDemoToken } from "@/lib/billing-demo";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** Prefer request origin so LAN IP access works; fall back to APP_URL. */
function publicOrigin(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const scheme = proto ?? (host.includes("localhost") || host.startsWith("127.") ? "http" : "http");
    return `${scheme}://${host}`;
  }
  return env.APP_URL.replace(/\/$/, "");
}

const bodySchema = z.object({
  pageId: z.string().min(1),
  blockId: z.string().min(1).optional(),
  kind: z.enum(["donation", "product"]),
  amountMinor: z.number().int().positive().max(10_000_000),
  currency: z.string().length(3).default("USD"),
  title: z.string().min(1).max(120).default("Payment"),
});

export async function POST(req: Request) {
  if (!isBillingConfigured()) {
    return errors.badRequest(
      "Billing is not enabled. Set FEATURE_BILLING=true (and Stripe keys or demo mode).",
    );
  }

  const ip = resolveFromHeaders(new Headers(req.headers)).ip ?? "unknown";
  const rl = await rateLimit(`billing:onetime:${ip}`, 20, 10);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const page = await prisma.page.findFirst({
    where: { id: parsed.data.pageId, deletedAt: null, isPublished: true },
    select: { id: true, slug: true, title: true, userId: true },
  });
  if (!page) return errors.notFound("Page not found");

  const currency = parsed.data.currency.toUpperCase();
  // Donation builder uses whole currency units (3, 5, 10); products use cents
  const unitAmountCents =
    parsed.data.kind === "donation" ? parsed.data.amountMinor * 100 : parsed.data.amountMinor;

  const origin = publicOrigin(req);
  const stripe = getStripe();

  // ── Real Stripe ──────────────────────────────────────────────────────────
  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: unitAmountCents,
            product_data: {
              name: parsed.data.title,
              description: `${parsed.data.kind} · ${page.title}`,
            },
          },
        },
      ],
      success_url: `${origin}/u/${page.slug}?paid=1&kind=${parsed.data.kind}`,
      cancel_url: `${origin}/u/${page.slug}?paid=0`,
      metadata: {
        pageId: page.id,
        ownerId: page.userId,
        blockId: parsed.data.blockId ?? "",
        kind: parsed.data.kind,
      },
    });
    return ok({ url: session.url, mode: "stripe" as const });
  }

  // ── Demo checkout (no Stripe keys) ───────────────────────────────────────
  if (!isDemoBillingEnabled()) {
    return errors.badRequest(
      "Stripe is not configured. Add STRIPE_SECRET_KEY or enable FEATURE_BILLING_DEMO=true.",
    );
  }

  const token = makeDemoToken({
    pageId: page.id,
    blockId: parsed.data.blockId ?? "",
    kind: parsed.data.kind,
    amountMinor: unitAmountCents,
    currency,
    title: parsed.data.title,
  });

  // Relative URL works on localhost and LAN IP without hardcoding APP_URL
  const url = `/pay/demo?token=${encodeURIComponent(token)}&slug=${encodeURIComponent(page.slug)}`;
  return ok({ url, mode: "demo" as const });
}
