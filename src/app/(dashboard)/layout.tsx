import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { DashboardShell } from "@/features/dashboard/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <DashboardShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        username: session.user.username,
      }}
      signOutAction={signOutAction}
    >
      {children}
    </DashboardShell>
  );
}
