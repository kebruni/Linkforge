/**
 * Regenerate recovery codes (invalidates all prior codes).  Requires that 2FA
 * is currently enabled and that the password is provided to prove ownership.
 */
import argon2 from "argon2";
import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { generateRecoveryCodes } from "@/lib/recovery";
import { writeAudit } from "@/lib/audit";
import { resolveFromHeaders } from "@/lib/geo";

export const runtime = "nodejs";

const bodySchema = z.object({ password: z.string().min(8).max(256) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const rl = await rateLimit(`auth:2fa:regen:${session.user.id}`, 3, 5);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true, twoFactorEnabled: true },
  });
  if (!user || !user.passwordHash) return errors.notFound();
  if (!user.twoFactorEnabled) return errors.conflict("Enable 2FA first");

  const passwordOk = await argon2.verify(user.passwordHash, parsed.data.password);
  if (!passwordOk) return errors.unauthorized("Password did not match");

  const { plain, hashes } = generateRecoveryCodes();

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.recoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ]);

  const ipInfo = resolveFromHeaders(new Headers(req.headers));
  await writeAudit({
    action: "USER_2FA_RECOVERY_REGENERATED",
    userId: user.id,
    ip: ipInfo.ip,
    userAgent: ipInfo.userAgent,
  });

  return ok({ recoveryCodes: plain });
}
