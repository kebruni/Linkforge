import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listUserSessions } from "@/lib/auth-sessions";

import { TwoFactorCard } from "@/features/security/two-factor-card";
import { SessionsList } from "@/features/security/sessions-list";
import { RegenerateCodesCard } from "@/features/security/regenerate-codes-card";

export const metadata = { title: "Security · Linkforge" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    }),
    listUserSessions(session.user.id),
  ]);
  if (!user) redirect("/login");

  // The full Date objects don't survive client serialization cleanly, so map
  // to ISO strings here.
  const initialSessions = sessions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    twoFactorPassedAt: s.twoFactorPassedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Security</h1>
        <p className="mt-1 text-muted-foreground">
          Two-factor authentication, recovery codes, and active device sessions.
        </p>
      </div>
      <TwoFactorCard initialEnabled={user.twoFactorEnabled} />
      <RegenerateCodesCard enabled={user.twoFactorEnabled} />
      <SessionsList initialSessions={initialSessions} />
    </div>
  );
}
