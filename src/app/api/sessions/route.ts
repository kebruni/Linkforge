import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { listAuthSessions, revokeAllOtherSessions } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const sessions = await listAuthSessions(session.user.id);
  return ok(
    sessions.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      ip: s.ip,
      country: s.country,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    })),
  );
}

/** Revoke all sessions for this user (forces re-login on all devices for next JWT expiry). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  await revokeAllOtherSessions(session.user.id);
  return ok({ revoked: true });
}
