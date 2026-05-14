import crypto from "crypto";
import { prisma } from "./db";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Returns the raw token (goes in the URL) and its SHA-256 hash (stored in DB). */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Creates a token row for the given user. Returns the raw token to send by email. */
export async function createResetToken(userId: string): Promise<string> {
  const { raw, hash } = generateResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return raw;
}

/**
 * Looks up a valid (non-expired, non-used) token by its raw value.
 * Returns the userId on success, null otherwise. Constant-time-ish:
 * always does the hash + DB lookup even when the input is malformed.
 */
export async function consumeResetToken(raw: string): Promise<string | null> {
  if (!raw || raw.length !== TOKEN_BYTES * 2) {
    // Still hit the DB to avoid timing oracles
    await prisma.passwordResetToken.findFirst({ where: { tokenHash: "__never__" } });
    return null;
  }

  const hash = hashResetToken(raw);
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } });
  if (!token) return null;
  if (token.usedAt) return null;
  if (token.expiresAt.getTime() < Date.now()) return null;

  await prisma.passwordResetToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  // Invalidate any other pending tokens for this user — once they've reset
  // we don't want stale links to keep working.
  await prisma.passwordResetToken.updateMany({
    where: { userId: token.userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  return token.userId;
}

/** Best-effort cleanup. Safe to call from any endpoint; idempotent. */
export async function purgeExpiredTokens(): Promise<void> {
  await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}
