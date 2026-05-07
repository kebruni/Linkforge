import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { headers } from "next/headers";
import { z } from "zod";
import argon2 from "argon2";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { authConfig } from "@/auth.config";
import { decryptString } from "@/lib/crypto";
import { verifyTotpCode } from "@/lib/totp";
import { hashRecoveryCode } from "@/lib/recovery";
import {
  geoFromRequest,
  recordSignIn,
  setSessionCookie,
} from "@/lib/auth-sessions";
import { writeAudit } from "@/lib/audit";
import { enqueueEmail, renderNewDeviceEmail } from "@/lib/email";
import { resolveFromHeaders } from "@/lib/geo";
import { env } from "@/lib/env";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
  totp: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/)
    .optional(),
  recoveryCode: z.string().trim().min(8).max(64).optional(),
});

/** Custom error types — surfaced to the client via `signIn(...).error.code`. */
export class TwoFactorRequired extends CredentialsSignin {
  code = "TWO_FACTOR_REQUIRED";
}
export class InvalidTwoFactor extends CredentialsSignin {
  code = "INVALID_TWO_FACTOR";
}
export class InvalidCredentials extends CredentialsSignin {
  code = "INVALID_CREDENTIALS";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "TOTP code", type: "text" },
        recoveryCode: { label: "Recovery code", type: "text" },
      },
      async authorize(input, request) {
        const parsed = credsSchema.safeParse(input);
        if (!parsed.success) throw new InvalidCredentials();
        const { email, password, totp, recoveryCode } = parsed.data;

        // Per-email rate-limit (IP-based limit is enforced separately in the
        // route handler — Auth.js doesn't expose the request here).
        const rl = await rateLimit(`auth:login:${email.toLowerCase()}`, 10, 30);
        if (!rl.ok) {
          logger.warn({ email }, "auth.login.rate_limited");
          throw new InvalidCredentials();
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user || !user.passwordHash || user.deletedAt) {
          throw new InvalidCredentials();
        }

        const passwordOk = await argon2.verify(user.passwordHash, password);
        if (!passwordOk) {
          await writeAudit({
            action: "USER_LOGIN_FAILED",
            userId: user.id,
            meta: { reason: "bad_password" },
          });
          throw new InvalidCredentials();
        }

        // 2FA challenge
        let twoFactorPassed = false;
        let recoveryUsed = false;
        if (user.twoFactorEnabled) {
          if (!totp && !recoveryCode) throw new TwoFactorRequired();

          if (totp) {
            if (!user.twoFactorSecret) throw new InvalidTwoFactor();
            let secret: string;
            try {
              secret = decryptString(user.twoFactorSecret);
            } catch {
              logger.error({ userId: user.id }, "auth.2fa.decrypt_failed");
              throw new InvalidTwoFactor();
            }
            if (!verifyTotpCode(secret, totp)) {
              await writeAudit({
                action: "USER_LOGIN_FAILED",
                userId: user.id,
                meta: { reason: "bad_totp" },
              });
              throw new InvalidTwoFactor();
            }
            twoFactorPassed = true;
          } else if (recoveryCode) {
            const codeHash = hashRecoveryCode(recoveryCode);
            const matched = await prisma.recoveryCode.findFirst({
              where: { userId: user.id, codeHash, usedAt: null },
            });
            if (!matched) {
              await writeAudit({
                action: "USER_LOGIN_FAILED",
                userId: user.id,
                meta: { reason: "bad_recovery_code" },
              });
              throw new InvalidTwoFactor();
            }
            await prisma.recoveryCode.update({
              where: { id: matched.id },
              data: { usedAt: new Date() },
            });
            twoFactorPassed = true;
            recoveryUsed = true;
          }
        }

        // Resolve geo from the inbound request.  In v5 beta the second arg is
        // a Web Request when called from the route handler.  Fall back to
        // `headers()` for parity with server-side reads.
        const geo = request
          ? geoFromRequest(request)
          : resolveFromHeaders(new Headers(await headers()));

        const { authSessionId, isNewDevice } = await recordSignIn({
          userId: user.id,
          geo,
          twoFactorPassed,
        });

        await setSessionCookie(authSessionId);

        await writeAudit({
          action: "USER_LOGIN",
          userId: user.id,
          targetId: authSessionId,
          ip: geo.ip,
          userAgent: geo.userAgent,
          meta: {
            provider: "credentials",
            country: geo.country,
            twoFactorPassed,
            recoveryUsed,
            isNewDevice,
          },
        });

        if (recoveryUsed) {
          await writeAudit({
            action: "USER_2FA_RECOVERY_USED",
            userId: user.id,
            ip: geo.ip,
          });
        }

        if (isNewDevice && env.SMTP_HOST) {
          const { subject, text } = renderNewDeviceEmail({
            userName: user.name ?? user.username,
            deviceLabel:
              geo.browser !== "unknown"
                ? `${geo.browser} on ${geo.os}`
                : "Unknown device",
            country: geo.country === "ZZ" ? null : geo.country,
            ip: geo.ip,
            occurredAt: new Date(),
            reviewUrl: `${env.APP_URL}/dashboard/settings/security`,
          });
          await enqueueEmail({
            to: user.email,
            subject,
            text,
            template: "new_device_signin",
            meta: { userId: user.id, authSessionId },
          });
          await writeAudit({
            action: "USER_LOGIN_NEW_DEVICE",
            userId: user.id,
            targetId: authSessionId,
            ip: geo.ip,
            meta: { country: geo.country },
          });
          await prisma.authSession.update({
            where: { id: authSessionId },
            data: { notifiedAt: new Date() },
          });
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.username,
          image: user.avatarUrl ?? null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.uid = user.id;
      }
      if (token.uid && (trigger === "signIn" || trigger === "update" || !token.role)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: String(token.uid) },
          select: { role: true, username: true, twoFactorEnabled: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.username = dbUser.username;
          token.twoFactorEnabled = dbUser.twoFactorEnabled;
        }
      }
      return token;
    },
  },
  events: {
    async signIn({ user, account }) {
      logger.info({ userId: user?.id, provider: account?.provider }, "auth.signIn");
    },
    async signOut(message) {
      logger.info({ message }, "auth.signOut");
    },
  },
});
