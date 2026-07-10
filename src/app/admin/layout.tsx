import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag, Shield, Users } from "lucide-react";
import { auth } from "@/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: Shield },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/flags", label: "Feature flags", icon: Flag },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r bg-muted/30">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <span className="grid size-8 place-items-center rounded-lg bg-destructive text-destructive-foreground text-xs font-bold">
            A
          </span>
          <div>
            <div className="text-sm font-semibold">Linkforge Admin</div>
            <div className="text-[11px] text-muted-foreground">internal</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground",
              )}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to app
          </Link>
        </nav>
      </aside>
      <main className="overflow-auto p-6 md:p-10">{children}</main>
    </div>
  );
}
