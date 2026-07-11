import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;

  const r = await prisma.apiKey.updateMany({
    where: { id, userId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (r.count === 0) return errors.notFound("API key not found");

  await writeAudit({
    action: "ADMIN_ACTION",
    userId: session.user.id,
    targetId: id,
    meta: { kind: "API_KEY_REVOKED" },
  });

  return ok({ id, revoked: true });
}
