import { randomBytes } from "node:crypto";
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
  code: z.string().min(6).max(12),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`2fa:confirm:${session.user.id}`, 10, 10);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return errors.badRequest("Invalid code");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });
  if (!user?.twoFactorSecret) {
    return errors.badRequest("Start enrollment first");
  }
  if (user.twoFactorEnabled) return errors.conflict("2FA already enabled");

  const secret = decryptString(user.twoFactorSecret);
  const valid = authenticator.verify({ token: parsed.data.code.replace(/\s/g, ""), secret });
  if (!valid) return errors.badRequest("Invalid authenticator code");

  // Generate 8 recovery codes
  const recoveryPlain: string[] = [];
  const recoveryRows: { userId: string; codeHash: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const code = randomBytes(5).toString("hex");
    recoveryPlain.push(code);
    recoveryRows.push({
      userId: session.user.id,
      codeHash: sha256Hex(code),
    });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: true },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId: session.user.id } }),
    prisma.recoveryCode.createMany({ data: recoveryRows }),
  ]);

  await writeAudit({
    action: "USER_2FA_ENABLED",
    userId: session.user.id,
  });

  return ok({ enabled: true, recoveryCodes: recoveryPlain });
}
