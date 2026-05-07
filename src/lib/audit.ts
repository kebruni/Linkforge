/**
 * Lightweight wrapper around `prisma.auditLog.create` so callers don't repeat
 * the same logger.warn-on-failure boilerplate everywhere.
 *
 * Audit failures must never break the user-facing flow — log + swallow.
 */
import type { AuditAction, Prisma } from "@prisma/client";

import { logger } from "./logger";
import { prisma } from "./prisma";

export interface AuditPayload {
  action: AuditAction;
  userId?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Prisma.InputJsonValue;
}

export async function writeAudit(p: AuditPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: p.action,
        userId: p.userId ?? null,
        targetId: p.targetId ?? null,
        ip: p.ip ?? null,
        userAgent: p.userAgent ?? null,
        meta: p.meta,
      },
    });
  } catch (err) {
    logger.warn({ err, action: p.action }, "audit.write_failed");
  }
}
