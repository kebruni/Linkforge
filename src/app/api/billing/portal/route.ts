import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireStripe, BillingNotConfiguredError } from "@/lib/stripe";
import { appUrl } from "@/lib/email";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`billing:portal:${session.user.id}`, 10, 10);
  if (!rl.ok) return errors.tooMany();

  let stripe;
  try {
    stripe = requireStripe();
  } catch (e) {
    if (e instanceof BillingNotConfiguredError) {
      return errors.badRequest("Billing is not enabled on this deployment");
    }
    throw e;
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });
  if (!sub?.stripeCustomerId) {
    return errors.badRequest("No billing customer yet — upgrade first");
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: appUrl("/dashboard/settings"),
  });

  return ok({ url: portal.url });
}
