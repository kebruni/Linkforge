import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireStripe, STRIPE_PLANS, BillingNotConfiguredError } from "@/lib/stripe";
import { appUrl } from "@/lib/email";

export const runtime = "nodejs";

const bodySchema = z.object({
  plan: z.enum(["PRO_MONTHLY", "PRO_YEARLY"]).default("PRO_MONTHLY"),
  couponCode: z.string().min(3).max(32).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`billing:checkout:${session.user.id}`, 10, 10);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) return errors.badRequest("Invalid plan");

  let stripe;
  try {
    stripe = requireStripe();
  } catch (e) {
    if (e instanceof BillingNotConfiguredError) {
      return errors.badRequest("Billing is not enabled on this deployment");
    }
    throw e;
  }

  const priceId =
    parsed.data.plan === "PRO_YEARLY"
      ? STRIPE_PLANS.PRO_YEARLY.priceEnv()
      : STRIPE_PLANS.PRO_MONTHLY.priceEnv();

  if (!priceId) {
    return errors.badRequest("Stripe price IDs are not configured");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      subscription: { select: { stripeCustomerId: true, status: true } },
    },
  });
  if (!user) return errors.notFound();

  let customerId = user.subscription?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeCustomerId: customerId,
        plan: parsed.data.plan,
        status: "INCOMPLETE",
      },
      update: { stripeCustomerId: customerId },
    });
  }

  // Optional first-party coupon — do NOT increment redemptions until webhook success
  let discounts: { coupon: string }[] | undefined;
  let couponMeta: string | undefined;
  if (parsed.data.couponCode) {
    const code = parsed.data.couponCode.toUpperCase();
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) return errors.badRequest("Invalid coupon code");
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return errors.badRequest("Coupon expired");
    }
    if (coupon.maxRedemptions != null && coupon.redemptions >= coupon.maxRedemptions) {
      return errors.badRequest("Coupon fully redeemed");
    }
    const stripeCoupon = await stripe.coupons.create({
      duration: "once",
      percent_off: coupon.percentOff ?? undefined,
      amount_off: coupon.amountOffMinor ?? undefined,
      currency: coupon.amountOffMinor ? coupon.currency.toLowerCase() : undefined,
      name: coupon.code,
      max_redemptions: 1,
      metadata: { linkforgeCouponId: coupon.id, code: coupon.code },
    });
    discounts = [{ coupon: stripeCoupon.id }];
    couponMeta = coupon.id;
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl("/dashboard/settings?billing=success"),
    cancel_url: appUrl("/dashboard/settings?billing=canceled"),
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      plan: parsed.data.plan,
      ...(couponMeta ? { couponId: couponMeta } : {}),
    },
    subscription_data: {
      metadata: { userId: user.id, plan: parsed.data.plan },
    },
    ...(discounts ? { discounts } : { allow_promotion_codes: true }),
  });

  return ok({ url: checkout.url });
}
