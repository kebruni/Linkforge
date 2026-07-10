/**
 * One-time verification / reset tokens stored as hashes in VerificationToken.
 */
import { sha256Hex } from "./crypto";
import { generateToken } from "./email";
import { prisma } from "./prisma";

export type TokenPurpose = "EMAIL_VERIFY" | "PASSWORD_RESET" | "MAGIC_LINK";

export async function issueToken(opts: {
  identifier: string;
  purpose: TokenPurpose;
  ttlMs: number;
}): Promise<string> {
  const raw = generateToken(32);
  const tokenHash = sha256Hex(raw);
  const expiresAt = new Date(Date.now() + opts.ttlMs);

  // Invalidate previous unused tokens for same purpose + identifier
  await prisma.verificationToken.updateMany({
    where: {
      identifier: opts.identifier,
      purpose: opts.purpose,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: opts.identifier,
      purpose: opts.purpose,
      tokenHash,
      expiresAt,
    },
  });

  return raw;
}

export async function consumeToken(opts: {
  raw: string;
  purpose: TokenPurpose;
}): Promise<{ identifier: string } | null> {
  const tokenHash = sha256Hex(opts.raw);
  const row = await prisma.verificationToken.findUnique({
    where: { tokenHash },
  });
  if (!row) return null;
  if (row.purpose !== opts.purpose) return null;
  if (row.consumedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await prisma.verificationToken.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  return { identifier: row.identifier };
}
