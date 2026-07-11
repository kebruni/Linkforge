import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { env } from "@/lib/env";

const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
const TWO_FA_ALLOW = ["/login/2fa", "/api/auth/2fa/verify", "/api/auth/signout"];

function appHostname(): string {
  try {
    return new URL(env.APP_URL).hostname.toLowerCase();
  } catch {
    return "localhost";
  }
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const host = (req.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
  const primary = appHostname();

  // Custom domain → rewrite to public page when host is not the primary app host
  if (
    env.FEATURE_CUSTOM_DOMAINS &&
    host &&
    host !== primary &&
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next")
  ) {
    try {
      const resolveUrl = new URL("/api/internal/resolve-host", req.nextUrl.origin);
      resolveUrl.searchParams.set("host", host);
      const res = await fetch(resolveUrl, {
        headers: { "x-forwarded-host": host },
        // Edge fetch to same origin
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; data?: { slug?: string } };
        const slug = json?.data?.slug;
        if (slug) {
          const rewrite = req.nextUrl.clone();
          // Keep path if already under /u, otherwise map root (+ optional path) to the page
          if (!pathname.startsWith("/u/")) {
            rewrite.pathname = `/u/${slug}`;
          }
          const response = NextResponse.rewrite(rewrite);
          response.headers.set("x-linkforge-domain", host);
          return response;
        }
      }
    } catch {
      // fall through to normal routing
    }
  }

  // Force 2FA step-up before any protected surface
  if (session?.user?.id && session.user.twoFactorPending) {
    const allowed = TWO_FA_ALLOW.some((p) => pathname.startsWith(p));
    if (!allowed && !pathname.startsWith("/api/auth")) {
      const url = req.nextUrl.clone();
      url.pathname = "/login/2fa";
      url.searchParams.set("next", pathname.startsWith("/login") ? "/dashboard" : pathname);
      return NextResponse.redirect(url);
    }
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  if (!session?.user?.id) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Run on app routes but skip static assets and pure public ingest endpoints.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/health|api/analytics/track|api/forms/submit|api/short|api/billing/webhook|api/billing/checkout-one-time|api/internal/resolve-host|api/reports).*)",
  ],
};
