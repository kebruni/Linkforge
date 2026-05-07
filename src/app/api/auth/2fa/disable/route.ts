/**
 * Disable 2FA.  Requires re-confirming the password (and either a current TOTP
 * code or one of the user's unused recovery codes).  Wipes the secret + all
 * recovery codes.
 */
import argon2 from "argon2";
import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { decryptString } from "@/lib/crypto";
import { verifyTotpCode } from "@/lib/totp";
import { hashRecoveryCode } from "@/lib/recovery";
import { writeAudit } from "@/lib/audit";
import { resolveFromHeaders } from "@/lib/geo";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    password: z.string().min(8).max(256),
    totp: z.string().trim().optional(),
    recoveryCode: z.string().trim().optional(),
  })
  .refine((b) => Boolean(b.totp || b.recoveryCode), {
    message: "Provide either a TOTP code or a recovery code",
    path: ["totp"],
  });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const rl = await rateLimit(`auth:2fa:disable:${session.user.id}`, 5, 10);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      passwordHash: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
    },
  });
  if (!user || !user.passwordHash) return errors.notFound();
  if (!user.twoFactorEnabled) {
    return errors.conflict("2FA is not enabled");
  }

  const passwordOk = await argon2.verify(user.passwordHash, parsed.data.password);
  if (!passwordOk) return errors.unauthorized("Password did not match");

  if (parsed.data.totp) {
    if (!user.twoFactorSecret) return errors.badRequest("Missing stored secret");
    const secret = decryptString(user.twoFactorSecret);
    if (!verifyTotpCode(secret, parsed.data.totp)) {
      return errors.badRequest("That code didn't match — try again");
    }
  } else if (parsed.data.recoveryCode) {
    const codeHash = hashRecoveryCode(parsed.data.recoveryCode);
    const matched = await prisma.recoveryCode.findFirst({
      where: { userId: user.id, codeHash, usedAt: null },
    });
    if (!matched) return errors.badRequest("Recovery code is invalid or already used");
    await prisma.recoveryCode.update({
      where: { id: matched.id },
      data: { usedAt: new Date() },
    });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);

  const ipInfo = resolveFromHeaders(new Headers(req.headers));
  await writeAudit({
    action: "USER_2FA_DISABLED",
    userId: user.id,
    ip: ipInfo.ip,
    userAgent: ipInfo.userAgent,
  });

  return ok({ disabled: true });
}
