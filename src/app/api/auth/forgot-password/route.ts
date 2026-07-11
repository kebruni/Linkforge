import { z } from "zod";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { issueToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { clientIp } from "@/lib/client-ip";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(254),
});

export async function POST(req: Request) {
  const ip = clientIp(new Headers(req.headers));
  const rl = await rateLimit(`auth:forgot:${ip}`, 5, 15);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return errors.badRequest("Invalid email");

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, deletedAt: true, passwordHash: true },
  });

  // Always return success to avoid account enumeration
  if (user && !user.deletedAt && user.passwordHash) {
    const token = await issueToken({
      identifier: user.id,
      purpose: "PASSWORD_RESET",
      ttlMs: 60 * 60 * 1000,
    });
    await sendPasswordResetEmail(user.email, token);
    logger.info({ userId: user.id }, "auth.forgot_password.sent");
  }

  return ok({ sent: true });
}
