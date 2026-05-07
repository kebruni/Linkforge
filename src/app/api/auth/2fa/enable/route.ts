/**
 * Confirm 2FA enrolment by verifying a TOTP code.  On success:
 *   - Set `twoFactorEnabled = true`
 *   - Generate 10 single-use recovery codes (return plaintext ONCE)
 *   - Wipe any prior recovery codes
 *   - Audit-log USER_2FA_ENABLED
 */
import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { decryptString } from "@/lib/crypto";
import { verifyTotpCode } from "@/lib/totp";
import { generateRecoveryCodes } from "@/lib/recovery";
import { writeAudit } from "@/lib/audit";
import { resolveFromHeaders } from "@/lib/geo";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/, "Enter a 6-digit code from your authenticator app"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const rl = await rateLimit(`auth:2fa:enable:${session.user.id}`, 10, 10);
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
      twoFactorEnabled: true,
      twoFactorSecret: true,
    },
  });
  if (!user) return errors.notFound();
  if (user.twoFactorEnabled) return errors.conflict("2FA already enabled");
  if (!user.twoFactorSecret) {
    return errors.badRequest("Begin 2FA setup first");
  }

  let secret: string;
  try {
    secret = decryptString(user.twoFactorSecret);
  } catch {
    return errors.internal("Could not decrypt the stored secret — please retry setup");
  }

  if (!verifyTotpCode(secret, parsed.data.code)) {
    return errors.badRequest("That code didn't match — try again");
  }

  const { plain, hashes } = generateRecoveryCodes();

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.recoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    }),
  ]);

  const ipInfo = resolveFromHeaders(new Headers(req.headers));
  await writeAudit({
    action: "USER_2FA_ENABLED",
    userId: user.id,
    ip: ipInfo.ip,
    userAgent: ipInfo.userAgent,
  });

  return ok({ recoveryCodes: plain });
}
