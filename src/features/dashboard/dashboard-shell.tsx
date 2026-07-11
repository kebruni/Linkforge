"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Inbox,
  Layout,
  Link2,
  LogOut,
  Menu,
  Settings,
  Wand2,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: Home, exact: true },
  { href: "/dashboard/pages", label: "Pages", icon: Layout },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/leads", label: "Leads", icon: Inbox },
  { href: "/dashboard/links", label: "Short links", icon: Link2 },
  { href: "/dashboard/ai", label: "AI co-pilot", icon: Wand2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

/** Primary destinations on the phone bottom bar */
const MOBILE_TAB = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/pages", label: "Pages", icon: Layout },
  { href: "/dashboard/analytics", label: "Stats", icon: BarChart3 },
  { href: "/dashboard/leads", label: "Leads", icon: Inbox },
  { href: "/dashboard/settings", label: "More", icon: Settings },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({
  children,
  user,
  signOutAction,
}: {
  children: React.ReactNode;
  user: {
    name: string | null | undefined;
    email: string | null | undefined;
    image: string | null | undefined;
    username: string;
  };
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const initials = (user.name ?? user.email ?? "U")
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
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
            <n.icon className="size-4 shrink-0" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const userRow = (
    <div className="flex items-center gap-3 border-t p-3">
      <Avatar>
        <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{user.name ?? user.email}</div>
        <div className="truncate text-xs text-muted-foreground">@{user.username}</div>
      </div>
      <form action={signOutAction}>
        <Button type="submit" size="icon" variant="ghost" aria-label="Sign out">
          <LogOut className="size-4" />
        </Button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col md:grid md:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="relative hidden border-r bg-muted/20 md:flex md:flex-col">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
            L
          </span>
          <span className="font-semibold">Linkforge</span>
        </div>
        {navLinks}
        <div className="mt-auto">{userRow}</div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="safe-area-pad absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-background shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
                  L
                </span>
                <span className="font-semibold">Linkforge</span>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-5" />
              </Button>
            </div>
            {navLinks}
            {userRow}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="safe-area-top sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:h-16 md:justify-end md:px-6">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
            <span className="grid size-7 place-items-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
              L
            </span>
            <span className="truncate text-sm font-semibold">Linkforge</span>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-auto p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-10 lg:p-10">
          {children}
        </main>

        {/* Mobile bottom tabs */}
        <nav
          className="safe-area-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden"
          aria-label="Primary"
        >
          <ul className="grid h-14 grid-cols-5">
            {MOBILE_TAB.map((t) => {
              const active = isActive(pathname, t.href, "exact" in t ? t.exact : false);
              return (
                <li key={t.href} className="min-w-0">
                  <Link
                    href={t.href}
                    className={cn(
                      "flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                      active ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    <t.icon className={cn("size-5", active && "stroke-[2.25px]")} />
                    <span className="truncate">{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
