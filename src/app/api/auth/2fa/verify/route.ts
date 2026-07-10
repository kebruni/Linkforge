/**
 * Completes 2FA step-up after password login.
 * Expects a JWT with twoFactorPending=true.
 */
import { authenticator } from "otplib";
import { z } from "zod";
import { encode, getToken } from "next-auth/jwt";
import { cookies } from "next/headers";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { decryptString, sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFromHeaders } from "@/lib/geo";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z.string().min(6).max(32),
});

function sessionCookieName() {
  return env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

export async function POST(req: Request) {
  const ip = resolveFromHeaders(new Headers(req.headers)).ip ?? "unknown";
  const rl = await rateLimit(`2fa:verify:${ip}`, 15, 10);
  if (!rl.ok) return errors.tooMany();

  const cookieStore = await cookies();
  const cookieName = sessionCookieName();

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const token = await getToken({
    req: {
      headers: { cookie: cookieHeader } as Record<string, string>,
    },
    secret: env.AUTH_SECRET,
    secureCookie: env.NODE_ENV === "production",
    salt: cookieName,
  });

  if (!token?.uid || !token.twoFactorPending) {
    return errors.unauthorized("No pending 2FA challenge");
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return errors.badRequest("Invalid code");

  const user = await prisma.user.findUnique({
    where: { id: String(token.uid) },
    select: {
      id: true,
      twoFactorSecret: true,
      twoFactorEnabled: true,
      role: true,
      username: true,
    },
  });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return errors.badRequest("2FA is not enabled");
  }

  const code = parsed.data.code.replace(/\s/g, "");
  const secret = decryptString(user.twoFactorSecret);
  let valid = authenticator.verify({ token: code, secret });

  if (!valid) {
    const hash = sha256Hex(code.toLowerCase());
    const recovery = await prisma.recoveryCode.findFirst({
      where: { userId: user.id, codeHash: hash, usedAt: null },
    });
    if (recovery) {
      valid = true;
      await prisma.recoveryCode.update({
        where: { id: recovery.id },
        data: { usedAt: new Date() },
      });
    }
  }

  if (!valid) return errors.badRequest("Invalid code");

  const maxAge = 30 * 24 * 60 * 60;
  const newToken = {
    ...token,
    twoFactorPending: false,
    twoFactorPassed: true,
    role: user.role,
    username: user.username,
    twoFactorEnabled: true,
  };

  const encoded = await encode({
    token: newToken,
    secret: env.AUTH_SECRET,
    salt: cookieName,
    maxAge,
  });

  cookieStore.set(cookieName, encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.NODE_ENV === "production",
    maxAge,
  });

  return ok({ verified: true });
}
