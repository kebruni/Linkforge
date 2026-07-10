import { authenticator } from "otplib";
import QRCode from "qrcode";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { encryptString } from "@/lib/crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`2fa:enroll:${session.user.id}`, 5, 10);
  if (!rl.ok) return errors.tooMany();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true, email: true },
  });
  if (!user) return errors.notFound();
  if (user.twoFactorEnabled) {
    return errors.conflict("2FA is already enabled");
  }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, env.APP_NAME, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });

  // Store encrypted secret temporarily (not enabled until confirm)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: encryptString(secret) },
  });

  return ok({
    secret,
    otpauth,
    qrDataUrl,
  });
}
