import { createHash, randomBytes } from 'node:crypto';
import { lt } from 'drizzle-orm';
import type { Database } from '../db/connection.js';
import { accessTokens, authorizationCodes, refreshTokens } from '../db/schema.js';

export function generateRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateClientId(): string {
  return `recto_${randomBytes(16).toString('hex')}`;
}

export function generateClientSecret(): string {
  return `recto_secret_${randomBytes(32).toString('hex')}`;
}

export function verifyPkceChallenge(verifier: string, challenge: string): boolean {
  const expected = createHash('sha256').update(verifier).digest('base64url');
  return expected === challenge;
}

export async function cleanupExpiredTokens(db: Database): Promise<void> {
  const now = new Date();
  await db.delete(authorizationCodes).where(lt(authorizationCodes.expiresAt, now));
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, now));
  await db.delete(accessTokens).where(lt(accessTokens.expiresAt, now));
}
