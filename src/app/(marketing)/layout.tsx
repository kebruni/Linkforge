import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { auth } from "@/auth";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-area-top sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
              <span className="font-bold">L</span>
            </span>
            <span className="truncate text-base font-semibold tracking-tight sm:text-lg">Linkforge</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="#faq" className="text-sm text-muted-foreground hover:text-foreground">
              FAQ
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {session?.user ? (
              <Button asChild size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden px-2 sm:inline-flex sm:px-3">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" variant="accent" className="px-2.5 sm:px-3">
                  <Link href="/register">
                    <span className="sm:hidden">Start</span>
                    <span className="hidden sm:inline">Get started</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="safe-area-bottom border-t border-border/60 py-8 sm:py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-center text-sm text-muted-foreground md:flex-row md:text-left">
          <p>© {new Date().getFullYear()} Linkforge. Built with Next.js, Prisma and Postgres.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/#features">Features</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
