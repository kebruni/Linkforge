import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
const TWO_FA_ALLOW = ["/login/2fa", "/api/auth/2fa/verify", "/api/auth/signout"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

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
    // Run on app routes but skip static assets, _next, and the public renderer.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|u/|api/health|api/analytics/track|api/forms/submit|api/short|api/billing/webhook|api/billing/checkout-one-time).*)",
  ],
};
