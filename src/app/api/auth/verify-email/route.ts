import { z } from "zod";

import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFromHeaders } from "@/lib/geo";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(16).max(256),
});

export async function POST(req: Request) {
  const ip = resolveFromHeaders(new Headers(req.headers)).ip ?? "unknown";
  const rl = await rateLimit(`auth:verify-email:${ip}`, 20, 15);
  if (!rl.ok) return errors.tooMany();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return errors.badRequest("Invalid token");

  const consumed = await consumeToken({
    raw: parsed.data.token,
    purpose: "EMAIL_VERIFY",
  });
  if (!consumed) return errors.badRequest("Invalid or expired verification link");

  await prisma.user.update({
    where: { id: consumed.identifier },
    data: { emailVerifiedAt: new Date() },
  });

  return ok({ verified: true });
}
