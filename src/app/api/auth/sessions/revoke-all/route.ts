/**
 * POST /api/auth/sessions/revoke-all — revoke every device session except the
 * current one (identified by the lf_sid cookie).
 */
import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import {
  getCurrentSessionId,
  revokeAllOtherSessions,
} from "@/lib/auth-sessions";
import { writeAudit } from "@/lib/audit";
import { resolveFromHeaders } from "@/lib/geo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();

  const rl = await rateLimit(`auth:sessions:revoke-all:${session.user.id}`, 5, 5);
  if (!rl.ok) return errors.tooMany();

  const current = await getCurrentSessionId();
  const count = await revokeAllOtherSessions(session.user.id, current);

  const ipInfo = resolveFromHeaders(new Headers(req.headers));
  await writeAudit({
    action: "USER_SESSION_REVOKED",
    userId: session.user.id,
    ip: ipInfo.ip,
    userAgent: ipInfo.userAgent,
    meta: { kind: "revoke_all", count, keptSessionId: current },
  });

  return ok({ revoked: count });
}
