import { type NextAuthConfig, type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { env } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "PRO" | "ADMIN" | "SUPPORT";
      username: string;
      twoFactorEnabled: boolean;
      twoFactorPending?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "USER" | "PRO" | "ADMIN" | "SUPPORT";
    username?: string;
    twoFactorEnabled?: boolean;
    twoFactorPending?: boolean;
    twoFactorPassed?: boolean;
  }
}

/**
 * Edge-safe auth config — no credentials provider (which would pull in argon2,
 * a Node-only native module).  Used by middleware.ts for session checks at the
 * edge.  The full config in auth.ts re-uses this and adds Credentials.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: env.AUTH_SECRET,
  trustHost: env.AUTH_TRUST_HOST,
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify",
  },
  providers: [
    ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })]
      : []),
    ...(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET
      ? [GitHub({ clientId: env.AUTH_GITHUB_ID, clientSecret: env.AUTH_GITHUB_SECRET })]
      : []),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = String(token.uid);
        session.user.role = token.role ?? "USER";
        session.user.username = token.username ?? "";
        session.user.twoFactorEnabled = Boolean(token.twoFactorEnabled);
        session.user.twoFactorPending = Boolean(token.twoFactorPending);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
