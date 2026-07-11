"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Menu, Shield, Ticket, Users, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: Shield, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: AlertTriangle },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/flags", label: "Feature flags", icon: Flag },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const links = (
    <nav className="space-y-1 p-3">
      {NAV.map((n) => {
        const active = isActive(pathname, n.href, "exact" in n ? n.exact : false);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-accent/15 font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
            )}
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        );
      })}
      <Link
        href="/dashboard"
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to app
      </Link>
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-muted/30 md:block">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <span className="grid size-8 place-items-center rounded-lg bg-destructive text-xs font-bold text-destructive-foreground">
            A
          </span>
          <div>
            <div className="text-sm font-semibold">Linkforge Admin</div>
            <div className="text-[11px] text-muted-foreground">internal</div>
          </div>
        </div>
        {links}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="safe-area-pad absolute inset-y-0 left-0 flex w-[min(100%,18rem)] flex-col bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-sm font-semibold">Admin</span>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-5" />
              </Button>
            </div>
            {links}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="safe-area-top sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:hidden">
          <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
          <span className="text-sm font-semibold">Linkforge Admin</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
