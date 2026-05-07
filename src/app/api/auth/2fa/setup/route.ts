/**
 * Begin 2FA enrolment.  Generates a fresh TOTP secret, stores it (encrypted)
 * on the user but does NOT yet flip `twoFactorEnabled` — that requires
 * verifying a code via /api/auth/2fa/enable.
 */
import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { encryptString } from "@/lib/crypto";
import { buildTotpQrDataUrl, buildTotpUri, generateTotpSecret } from "@/lib/totp";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const rl = await rateLimit(`auth:2fa:setup:${session.user.id}`, 5, 5);
  if (!rl.ok) return errors.tooMany();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, twoFactorEnabled: true },
  });
  if (!user) return errors.notFound();
  if (user.twoFactorEnabled) {
    return errors.conflict("2FA is already enabled — disable it first to re-enrol");
  }

  const secret = generateTotpSecret();
  const accountLabel = `${user.email}`;
  const uri = buildTotpUri(secret, accountLabel);
  const qrDataUrl = await buildTotpQrDataUrl(uri);

  // Persist encrypted secret so the user can verify later — but keep
  // `twoFactorEnabled` false until /enable confirms a working code.
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: encryptString(secret) },
  });

  return ok({
    secret,
    uri,
    qrDataUrl,
    issuer: env.APP_NAME,
    account: accountLabel,
  });
}

// Accidental GET should not leak anything.
export function GET() {
  return errors.badRequest("Use POST to begin 2FA setup");
}
