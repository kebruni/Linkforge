import argon2 from "argon2";
import { authenticator } from "otplib";
import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { decryptString, sha256Hex } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  password: z.string().min(8).max(256),
  code: z.string().min(6).max(32),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`2fa:disable:${session.user.id}`, 5, 15);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return errors.badRequest("Invalid input");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
    },
  });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return errors.badRequest("2FA is not enabled");
  }
  if (!user.passwordHash) return errors.badRequest("Password required");

  const pwdOk = await argon2.verify(user.passwordHash, parsed.data.password);
  if (!pwdOk) return errors.unauthorized("Invalid password");

  const code = parsed.data.code.replace(/\s/g, "").toLowerCase();
  const secret = decryptString(user.twoFactorSecret);
  let okCode = authenticator.verify({ token: code, secret });

  if (!okCode) {
    // Try recovery code
    const hash = sha256Hex(code);
    const recovery = await prisma.recoveryCode.findFirst({
      where: { userId: session.user.id, codeHash: hash, usedAt: null },
    });
    if (recovery) {
      okCode = true;
      await prisma.recoveryCode.update({
        where: { id: recovery.id },
        data: { usedAt: new Date() },
      });
    }
  }

  if (!okCode) return errors.badRequest("Invalid code");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId: session.user.id } }),
  ]);

  await writeAudit({
    action: "USER_2FA_DISABLED",
    userId: session.user.id,
  });

  return ok({ disabled: true });
}
