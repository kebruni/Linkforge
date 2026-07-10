import argon2 from "argon2";
import { z } from "zod";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFromHeaders } from "@/lib/geo";
import { consumeToken } from "@/lib/tokens";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(8).max(256),
});

export async function POST(req: Request) {
  const ip = resolveFromHeaders(new Headers(req.headers)).ip ?? "unknown";
  const rl = await rateLimit(`auth:reset:${ip}`, 10, 15);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const consumed = await consumeToken({
    raw: parsed.data.token,
    purpose: "PASSWORD_RESET",
  });
  if (!consumed) return errors.badRequest("Invalid or expired reset link");

  const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
  const user = await prisma.user.update({
    where: { id: consumed.identifier },
    data: { passwordHash },
    select: { id: true },
  });

  await writeAudit({
    action: "USER_PASSWORD_CHANGED",
    userId: user.id,
    ip,
  });
  logger.info({ userId: user.id }, "auth.password_reset.success");

  return ok({ reset: true });
}
