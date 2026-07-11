/**
 * Freemium plan gates — single source of truth for limits.
 */
import type { UserRole } from "@prisma/client";

export const FREE_PAGE_LIMIT = 3;
export const FREE_SHORT_LINK_LIMIT = 10;
export const FREE_WEBHOOK_LIMIT = 0;
export const PRO_WEBHOOK_LIMIT = 20;
export const FREE_API_KEY_LIMIT = 0;
export const PRO_API_KEY_LIMIT = 10;

export function isProRole(role: UserRole | string | undefined | null): boolean {
  return role === "PRO" || role === "ADMIN" || role === "SUPPORT";
}

export function pageLimitFor(role: UserRole | string | undefined | null): number {
  return isProRole(role) ? Number.POSITIVE_INFINITY : FREE_PAGE_LIMIT;
}

export function shortLinkLimitFor(role: UserRole | string | undefined | null): number {
  return isProRole(role) ? Number.POSITIVE_INFINITY : FREE_SHORT_LINK_LIMIT;
}

export function webhookLimitFor(role: UserRole | string | undefined | null): number {
  return isProRole(role) ? PRO_WEBHOOK_LIMIT : FREE_WEBHOOK_LIMIT;
}

export function apiKeyLimitFor(role: UserRole | string | undefined | null): number {
  return isProRole(role) ? PRO_API_KEY_LIMIT : FREE_API_KEY_LIMIT;
}

export function canUseCustomDomains(role: UserRole | string | undefined | null): boolean {
  return isProRole(role);
}

export function canUseAi(role: UserRole | string | undefined | null, featureOn: boolean): boolean {
  if (!featureOn) return false;
  // Free tier gets limited offline AI; PRO gets full
  return true;
}
