/**
 * DELETE /api/auth/sessions/:id — revoke a single session row.
 *
 * Note: revoking a session row only invalidates the device-list entry today.
 * The associated NextAuth JWT cookie still works until it expires; full
 * server-side JWT revocation is part of the v1.2 short-lived-token migration.
 */
import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { revokeSession } from "@/lib/auth-sessions";
import { writeAudit } from "@/lib/audit";
import { resolveFromHeaders } from "@/lib/geo";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const rl = await rateLimit(`auth:sessions:revoke:${session.user.id}`, 30, 30);
  if (!rl.ok) return errors.tooMany();

  const { id } = await params;
  if (!id) return errors.badRequest("Missing session id");

  const revoked = await revokeSession(session.user.id, id);
  if (!revoked) return errors.notFound("Session not found or already revoked");

  const ipInfo = resolveFromHeaders(new Headers(req.headers));
  await writeAudit({
    action: "USER_SESSION_REVOKED",
    userId: session.user.id,
    targetId: id,
    ip: ipInfo.ip,
    userAgent: ipInfo.userAgent,
  });

  return ok({ revoked: true });
}
