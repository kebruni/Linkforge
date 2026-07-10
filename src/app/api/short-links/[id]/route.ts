import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const { id } = await params;
  const link = await prisma.shortLink.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!link) return errors.notFound();

  await prisma.shortLink.delete({ where: { id } });
  return ok({ deleted: true });
}
