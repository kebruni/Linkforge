/**
 * Login pre-flight: verify (email, password) before triggering signIn.
 *
 * The login form uses this to learn whether 2FA is required *before* asking
 * the user for a TOTP/recovery code, so we can show a single clean form per
 * step instead of guessing.  The endpoint is heavily rate-limited per IP+email
 * and never reveals whether the email exists.
 */
import argon2 from "argon2";
import { z } from "zod";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFromHeaders } from "@/lib/geo";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(256),
});

export async function POST(req: Request) {
  const ipInfo = resolveFromHeaders(new Headers(req.headers));
  const ipKey = ipInfo.ip ?? "unknown";

  const ipRl = await rateLimit(`auth:preflight:ip:${ipKey}`, 20, 30);
  if (!ipRl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }
  const { email, password } = parsed.data;

  const emailRl = await rateLimit(`auth:preflight:email:${email.toLowerCase()}`, 10, 30);
  if (!emailRl.ok) return errors.tooMany();

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, passwordHash: true, deletedAt: true, twoFactorEnabled: true },
  });
  if (!user || !user.passwordHash || user.deletedAt) {
    return errors.unauthorized("Invalid email or password");
  }

  const okPwd = await argon2.verify(user.passwordHash, password);
  if (!okPwd) {
    logger.info({ email: email.toLowerCase() }, "auth.preflight.bad_password");
    return errors.unauthorized("Invalid email or password");
  }

  return ok({ requires2FA: user.twoFactorEnabled });
}
