/**
 * Lazy Stripe client. Billing is optional — when STRIPE_SECRET_KEY is empty
 * we can still run demo checkout if FEATURE_BILLING_DEMO / development.
 */
import Stripe from "stripe";
import { env, isDev } from "./env";

let client: Stripe | null | undefined;

/** Real Stripe secret key present */
export function hasStripeKey(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

/**
 * Demo checkout is allowed when billing is on and either:
 * - FEATURE_BILLING_DEMO is explicitly true, or
 * - we're in development without a Stripe key
 */
export function isDemoBillingEnabled(): boolean {
  if (!env.FEATURE_BILLING) return false;
  if (env.FEATURE_BILLING_DEMO) return true;
  // Dev convenience: no Stripe key → demo payments still work
  if (isDev && !hasStripeKey()) return true;
  return false;
}

/** UI + API: payments available (Stripe and/or demo) */
export function isBillingConfigured(): boolean {
  if (!env.FEATURE_BILLING) return false;
  return hasStripeKey() || isDemoBillingEnabled();
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
