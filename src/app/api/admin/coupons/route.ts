import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const createSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(32)
      .regex(/^[A-Z0-9_-]+$/i, "Code must be alphanumeric"),
    description: z.string().max(200).optional(),
    percentOff: z.number().int().min(1).max(100).optional(),
    amountOffMinor: z.number().int().min(1).optional(),
    currency: z.string().length(3).default("USD"),
    expiresAt: z.string().datetime().optional().nullable(),
    maxRedemptions: z.number().int().min(1).optional().nullable(),
  })
  .refine((d) => d.percentOff || d.amountOffMinor, {
    message: "Set percentOff or amountOffMinor",
  });

export async function GET() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  if (session.user.role !== "ADMIN") return errors.forbidden();

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(
    coupons.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      percentOff: c.percentOff,
      amountOffMinor: c.amountOffMinor,
      currency: c.currency,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      maxRedemptions: c.maxRedemptions,
      redemptions: c.redemptions,
      createdAt: c.createdAt.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  if (session.user.role !== "ADMIN") return errors.forbidden();

  const rl = await rateLimit(`admin:coupons:${session.user.id}`, 20, env.RATE_LIMIT_WRITES_PER_MIN);
  if (!rl.ok) return errors.tooMany();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid coupon", parsed.error.flatten().fieldErrors);

  const code = parsed.data.code.toUpperCase();
  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) return errors.conflict("Coupon code already exists");

  const row = await prisma.coupon.create({
    data: {
      code,
      description: parsed.data.description ?? null,
      percentOff: parsed.data.percentOff ?? null,
      amountOffMinor: parsed.data.amountOffMinor ?? null,
      currency: parsed.data.currency.toUpperCase(),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      maxRedemptions: parsed.data.maxRedemptions ?? null,
    },
  });

  return ok(
    {
      id: row.id,
      code: row.code,
      percentOff: row.percentOff,
      amountOffMinor: row.amountOffMinor,
      createdAt: row.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
