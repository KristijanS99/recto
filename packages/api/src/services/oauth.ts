import { createHash, randomBytes } from 'node:crypto';

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
