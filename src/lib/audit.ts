import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function writeAudit(opts: {
  action: AuditAction;
  userId?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: opts.action,
        userId: opts.userId ?? null,
        targetId: opts.targetId ?? null,
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
        meta: opts.meta ?? undefined,
      },
    });
  } catch {
    // Audit must never break the main flow
  }
}
