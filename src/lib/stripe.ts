/**
 * Lazy Stripe client. Billing is optional — when STRIPE_SECRET_KEY is empty
 * all helpers return null / throw a typed error so the UI can degrade gracefully.
 */
import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | null | undefined;

export function isBillingConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.FEATURE_BILLING);
}

export function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  if (client === undefined) {
    client = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return client;
}

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Stripe billing is not configured");
    this.name = "BillingNotConfiguredError";
  }
}

export function requireStripe(): Stripe {
  const s = getStripe();
  if (!s || !env.FEATURE_BILLING) throw new BillingNotConfiguredError();
  return s;
}

export const STRIPE_PLANS = {
  PRO_MONTHLY: {
    plan: "PRO_MONTHLY" as const,
    priceEnv: () => env.STRIPE_PRICE_PRO_MONTHLY,
  },
  PRO_YEARLY: {
    plan: "PRO_YEARLY" as const,
    priceEnv: () => env.STRIPE_PRICE_PRO_YEARLY,
  },
};
