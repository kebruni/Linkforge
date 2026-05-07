/**
 * GET /api/auth/sessions — list the user's active AuthSession rows
 */
import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { listUserSessions } from "@/lib/auth-sessions";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return errors.unauthorized();
  const sessions = await listUserSessions(session.user.id);
  return ok({ sessions });
}
