import { z } from "zod";
import { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  suspended: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  if (session.user.role !== "ADMIN") return errors.forbidden();

  const rl = await rateLimit(`admin:user:${session.user.id}`, 30, 10);
  if (!rl.ok) return errors.tooMany();

  const { id } = await params;
  if (id === session.user.id) {
    return errors.badRequest("Cannot modify your own admin account this way");
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return errors.badRequest("Invalid input");

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!target) return errors.notFound();

  const data: { role?: UserRole; deletedAt?: Date | null } = {};
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.suspended === true) data.deletedAt = new Date();
  if (parsed.data.suspended === false) data.deletedAt = null;

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      deletedAt: true,
    },
  });

  await writeAudit({
    action: parsed.data.suspended ? "USER_SUSPENDED" : "ADMIN_ACTION",
    userId: session.user.id,
    targetId: id,
    meta: parsed.data,
  });

  return ok(user);
}
