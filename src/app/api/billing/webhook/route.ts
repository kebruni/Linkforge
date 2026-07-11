import type Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE_EXPIRED",
  unpaid: "UNPAID",
};

function mapStatus(s: string | null | undefined): SubscriptionStatus {
  return STATUS_MAP[s ?? ""] ?? "INCOMPLETE";
}

async function applySubscription(sub: Stripe.Subscription, userId: string) {
  const price = sub.items.data[0]?.price;
  const plan =
    (sub.metadata?.plan as string) ||
    (price?.recurring?.interval === "year" ? "PRO_YEARLY" : "PRO_MONTHLY");
  const status = mapStatus(sub.status);
  const isPro = status === "ACTIVE" || status === "TRIALING";

  // Stripe SDK v22: current_period_* lives on subscription items in newer API
  const item = sub.items.data[0] as
    | (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number })
    | undefined;
  const periodStartSec =
    item?.current_period_start ??
    (sub as unknown as { current_period_start?: number }).current_period_start;
  const periodEndSec =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: String(sub.customer),
      stripeSubscriptionId: sub.id,
      status,
      plan,
      priceMinor: price?.unit_amount ?? 0,
      currency: (price?.currency ?? "usd").toUpperCase(),
      currentPeriodStart: periodStartSec ? new Date(periodStartSec * 1000) : null,
      currentPeriodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
    update: {
      stripeCustomerId: String(sub.customer),
      stripeSubscriptionId: sub.id,
      status,
      plan,
      priceMinor: price?.unit_amount ?? 0,
      currency: (price?.currency ?? "usd").toUpperCase(),
      currentPeriodStart: periodStartSec ? new Date(periodStartSec * 1000) : null,
      currentPeriodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user && user.role !== "ADMIN" && user.role !== "SUPPORT") {
    await prisma.user.update({
      where: { id: userId },
      data: { role: isPro ? "PRO" : "USER" },
    });
  }
}

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return errors.badRequest("Webhooks not configured");
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return errors.badRequest("Missing signature");

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, "billing.webhook.invalid_signature");
    return errors.badRequest("Invalid signature");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        if (userId && session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(session.subscription));
          await applySubscription(sub, userId);
          await writeAudit({
            action: "BILLING_SUBSCRIBED",
            userId,
            targetId: sub.id,
            meta: { plan: session.metadata?.plan },
          });
        }
        // Redeem first-party coupon only after successful payment
        const couponId = session.metadata?.couponId;
        if (couponId) {
          await prisma.coupon.updateMany({
            where: { id: couponId },
            data: { redemptions: { increment: 1 } },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) await applySubscription(sub, userId);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await applySubscription(sub, userId);
          await writeAudit({
            action: "BILLING_CANCELED",
            userId,
            targetId: sub.id,
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "billing.webhook.handler_error");
    return errors.internal("Webhook handler failed");
  }

  return ok({ received: true });
}
