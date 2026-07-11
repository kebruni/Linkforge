import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { revokeAuthSession } from "@/lib/sessions";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;
  const okRevoke = await revokeAuthSession(session.user.id, id);
  if (!okRevoke) return errors.notFound("Session not found");
  return ok({ id, revoked: true });
}
