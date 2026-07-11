/**
 * Server-side device sessions (AuthSession table) complementary to JWT cookies.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { sha256Hex } from "./crypto";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createAuthSession(opts: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  country?: string | null;
}) {
  const refresh = randomBytes(32).toString("base64url");
  const deviceLabel = deviceFromUa(opts.userAgent);
  const row = await prisma.authSession.create({
    data: {
      userId: opts.userId,
      refreshTokenHash: sha256Hex(refresh),
      deviceLabel,
      ip: opts.ip ?? null,
      country: opts.country ?? null,
      userAgent: opts.userAgent?.slice(0, 400) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      lastUsedAt: new Date(),
    },
    select: { id: true },
  });
  return { id: row.id, refresh };
}

function deviceFromUa(ua?: string | null): string {
  if (!ua) return "Unknown device";
  const s = ua.toLowerCase();
  let os = "Unknown OS";
  if (s.includes("android")) os = "Android";
  else if (s.includes("iphone") || s.includes("ipad")) os = "iOS";
  else if (s.includes("mac os")) os = "macOS";
  else if (s.includes("windows")) os = "Windows";
  else if (s.includes("linux")) os = "Linux";

  let browser = "Browser";
  if (s.includes("edg/")) browser = "Edge";
  else if (s.includes("chrome/")) browser = "Chrome";
  else if (s.includes("firefox/")) browser = "Firefox";
  else if (s.includes("safari/") && !s.includes("chrome")) browser = "Safari";

  return `${browser} on ${os}`;
}

export async function listAuthSessions(userId: string) {
  return prisma.authSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      deviceLabel: true,
      ip: true,
      country: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
}

export async function revokeAuthSession(userId: string, sessionId: string) {
  const r = await prisma.authSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return r.count > 0;
}

export async function revokeAllOtherSessions(userId: string, keepId?: string | null) {
  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keepId ? { id: { not: keepId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}
