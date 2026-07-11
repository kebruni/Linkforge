import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/features/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return <AdminShell>{children}</AdminShell>;
}
