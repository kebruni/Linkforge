/**
 * Server-side AuthSession lifecycle.
 *
 * Auth.js stores its own JWT cookie; AuthSession is the *device/session ledger*
 * we expose to users in `/dashboard/settings/security` and to the suspicious-
 * login detector.  We create one row per successful credential sign-in,
 * fingerprint it with hashed IP + UA + country, and reuse it on subsequent
 * logins from the same device so the list stays small and meaningful.
 *
 * Pseudo-stable session id is stored in a long-lived cookie (`lf_sid`) so we
 * can match a JWT to its AuthSession row across renews.
 */
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";

import { sha256Hex } from "./crypto";
import { resolveFromHeaders, type ResolvedGeo } from "./geo";
import { logger } from "./logger";
import { prisma } from "./prisma";

const SESSION_COOKIE = "lf_sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d, matches NextAuth maxAge.

export interface SignInContext {
  userId: string;
  geo: ResolvedGeo;
  twoFactorPassed: boolean;
}

export interface SignInResult {
  authSessionId: string;
  isNewDevice: boolean;
}

/**
 * Best-effort device label (e.g. "Chrome on macOS") from a parsed UA string.
 */
function deviceLabelFor(geo: ResolvedGeo): string {
  const browser = geo.browser !== "unknown" ? geo.browser : null;
  const os = geo.os !== "unknown" ? geo.os : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}

/**
 * Look up — or create — the AuthSession row for a successful sign-in.
 *
 * Heuristic: if a non-revoked, non-expired session exists for the same
 * (userId, ipHash, userAgent), reuse it (bump `lastUsedAt`).  Otherwise
 * insert a new row and flag it as a new device.
 */
export async function recordSignIn(ctx: SignInContext): Promise<SignInResult> {
  const ipHash = ctx.geo.ip ? sha256Hex(ctx.geo.ip) : null;
  const now = new Date();

  const existing = await prisma.authSession.findFirst({
    where: {
      userId: ctx.userId,
      revokedAt: null,
      expiresAt: { gt: now },
      ipHash,
      userAgent: ctx.geo.userAgent,
    },
    orderBy: { lastUsedAt: "desc" },
  });

  if (existing) {
    await prisma.authSession.update({
      where: { id: existing.id },
      data: {
        lastUsedAt: now,
        twoFactorPassedAt: ctx.twoFactorPassed ? now : existing.twoFactorPassedAt,
        country: ctx.geo.country,
      },
    });
    return { authSessionId: existing.id, isNewDevice: false };
  }

  // Hash a random refresh token; we don't currently rotate it but the column
  // is unique so seed with a fresh value per row.
  const refreshTokenHash = sha256Hex(`${ctx.userId}:${now.toISOString()}:${Math.random()}`);

  const created = await prisma.authSession.create({
    data: {
      userId: ctx.userId,
      refreshTokenHash,
      deviceLabel: deviceLabelFor(ctx.geo),
      ip: ctx.geo.ip,
      ipHash,
      country: ctx.geo.country,
      userAgent: ctx.geo.userAgent,
      device: ctx.geo.device,
      os: ctx.geo.os,
      browser: ctx.geo.browser,
      twoFactorPassedAt: ctx.twoFactorPassed ? now : null,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    },
  });
  return { authSessionId: created.id, isNewDevice: true };
}

/**
 * Persist the session id in a cookie so the public site can correlate the JWT
 * to a server-side row (used to revoke sessions on demand).
 */
export async function setSessionCookie(authSessionId: string): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, authSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
  } catch (err) {
    // `cookies()` throws when called outside a request scope (e.g. during a
    // background job or test).  Tolerate it — the cookie is a UX nicety.
    logger.debug({ err }, "auth-sessions.cookie_skip");
  }
}

export async function getCurrentSessionId(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function clearSessionCookie(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
  } catch {
    /* noop */
  }
}

export interface ListedSession {
  id: string;
  deviceLabel: string;
  ip: string | null;
  country: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  twoFactorPassedAt: Date | null;
  isCurrent: boolean;
}

export async function listUserSessions(userId: string): Promise<ListedSession[]> {
  const current = await getCurrentSessionId();
  const rows = await prisma.authSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastUsedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    deviceLabel: r.deviceLabel ?? "Unknown device",
    ip: r.ip,
    country: r.country,
    device: r.device,
    os: r.os,
    browser: r.browser,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
    expiresAt: r.expiresAt,
    twoFactorPassedAt: r.twoFactorPassedAt,
    isCurrent: r.id === current,
  }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const res = await prisma.authSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export async function revokeAllOtherSessions(
  userId: string,
  keepSessionId: string | null,
): Promise<number> {
  const where: Prisma.AuthSessionWhereInput = {
    userId,
    revokedAt: null,
  };
  if (keepSessionId) where.id = { not: keepSessionId };
  const res = await prisma.authSession.updateMany({
    where,
    data: { revokedAt: new Date() },
  });
  return res.count;
}

/**
 * Resolve geo + UA from the inbound request once and reuse it across the
 * sign-in pipeline.
 */
export function geoFromRequest(req: Request): ResolvedGeo {
  return resolveFromHeaders(new Headers(req.headers));
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
