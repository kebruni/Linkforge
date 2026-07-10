import argon2 from "argon2";
import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  currentPassword: z.string().min(8).max(256),
  newPassword: z.string().min(8).max(256),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`auth:change-pw:${session.user.id}`, 5, 15);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return errors.badRequest("Invalid input");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return errors.badRequest("Password login is not set up for this account");
  }

  const okPwd = await argon2.verify(user.passwordHash, parsed.data.currentPassword);
  if (!okPwd) return errors.unauthorized("Current password is incorrect");

  const passwordHash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  await writeAudit({
    action: "USER_PASSWORD_CHANGED",
    userId: session.user.id,
  });

  return ok({ changed: true });
}
