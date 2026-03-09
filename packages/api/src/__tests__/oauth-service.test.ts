import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generateClientId,
  generateClientSecret,
  generateRandomToken,
  hashToken,
  verifyPkceChallenge,
} from '../services/oauth.js';

describe('OAuth Service', () => {
  describe('generateRandomToken', () => {
    it('generates a 32-byte hex string by default', () => {
      const token = generateRandomToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates tokens of specified length', () => {
      const token = generateRandomToken(16);
      expect(token).toMatch(/^[a-f0-9]{32}$/);
    });

    it('generates unique tokens', () => {
      const a = generateRandomToken();
      const b = generateRandomToken();
      expect(a).not.toBe(b);
    });
  });

  describe('hashToken', () => {
    it('returns a SHA-256 hex hash', () => {
      const hash = hashToken('test-token');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces consistent hashes', () => {
      expect(hashToken('same')).toBe(hashToken('same'));
    });

    it('produces different hashes for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });
  });

  describe('generateClientId', () => {
    it('generates a prefixed client ID', () => {
      const id = generateClientId();
      expect(id).toMatch(/^recto_/);
      expect(id.length).toBeGreaterThan(10);
    });
  });

  describe('generateClientSecret', () => {
    it('generates a prefixed client secret', () => {
      const secret = generateClientSecret();
      expect(secret).toMatch(/^recto_secret_/);
      expect(secret.length).toBeGreaterThan(20);
    });
  });

  describe('verifyPkceChallenge', () => {
    it('verifies a valid S256 challenge', () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const expectedChallenge = createHash('sha256').update(verifier).digest('base64url');

      expect(verifyPkceChallenge(verifier, expectedChallenge)).toBe(true);
    });

    it('rejects an invalid challenge', () => {
      expect(verifyPkceChallenge('verifier', 'wrong-challenge')).toBe(false);
    });
  });
});
