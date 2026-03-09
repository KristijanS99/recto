import { createHash } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Hono } from 'hono';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema.js';
import { authorizationCodes, oauthClients } from '../db/schema.js';
import { oauthRoutes } from '../routes/oauth.js';
import { hashToken } from '../services/oauth.js';

const API_KEY = 'test-api-key';

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
// biome-ignore lint/suspicious/noExplicitAny: test helper
let db: any;

beforeAll(async () => {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();
  client = postgres(container.getConnectionUri());
  db = drizzle(client, { schema });

  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(db, {
    migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
  });

  await db.insert(oauthClients).values({
    clientId: 'recto_test',
    clientName: 'Test',
    redirectUris: ['http://localhost:3000/callback'],
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'none',
  });
}, 60_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
}, 30_000);

function createTestApp() {
  return new Hono().route(
    '/',
    oauthRoutes({
      issuerUrl: 'https://recto.example.com',
      db,
      apiKey: API_KEY,
      accessTokenTtl: 3600,
      refreshTokenTtl: 7776000,
    }),
  );
}

async function insertAuthCode(codeVerifier: string) {
  const code = `test-auth-code-${Date.now()}-${Math.random()}`;
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  await db.insert(authorizationCodes).values({
    code: hashToken(code),
    clientId: 'recto_test',
    redirectUri: 'http://localhost:3000/callback',
    codeChallenge,
    codeChallengeMethod: 'S256',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  return code;
}

describe('POST /token', () => {
  describe('authorization_code grant', () => {
    it('exchanges code for access + refresh token', async () => {
      const app = createTestApp();
      const codeVerifier = 'a-valid-code-verifier-string-that-is-long-enough';
      const code = await insertAuthCode(codeVerifier);

      const res = await app.request('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          client_id: 'recto_test',
          redirect_uri: 'http://localhost:3000/callback',
        }).toString(),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.access_token).toBeTruthy();
      expect(body.refresh_token).toBeTruthy();
      expect(body.token_type).toBe('Bearer');
      expect(body.expires_in).toBe(3600);
    });

    it('rejects invalid code_verifier', async () => {
      const app = createTestApp();
      const code = await insertAuthCode('correct-verifier');

      const res = await app.request('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: 'wrong-verifier',
          client_id: 'recto_test',
          redirect_uri: 'http://localhost:3000/callback',
        }).toString(),
      });

      expect(res.status).toBe(400);
    });

    it('rejects already-used code', async () => {
      const app = createTestApp();
      const codeVerifier = 'another-valid-verifier-string';
      const code = await insertAuthCode(codeVerifier);

      // First exchange
      await app.request('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          client_id: 'recto_test',
          redirect_uri: 'http://localhost:3000/callback',
        }).toString(),
      });

      // Second exchange
      const res = await app.request('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          client_id: 'recto_test',
          redirect_uri: 'http://localhost:3000/callback',
        }).toString(),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('refresh_token grant', () => {
    it('issues new tokens and rotates refresh token', async () => {
      const app = createTestApp();
      const codeVerifier = 'refresh-test-verifier-string';
      const code = await insertAuthCode(codeVerifier);

      // Get initial tokens
      const tokenRes = await app.request('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          client_id: 'recto_test',
          redirect_uri: 'http://localhost:3000/callback',
        }).toString(),
      });

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token: string;
        token_type: string;
        expires_in: number;
      };

      // Refresh
      const refreshRes = await app.request('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: 'recto_test',
        }).toString(),
      });

      expect(refreshRes.status).toBe(200);
      const newTokens = (await refreshRes.json()) as Record<string, unknown>;
      expect(newTokens.access_token).toBeTruthy();
      expect(newTokens.refresh_token).toBeTruthy();
      expect(newTokens.access_token).not.toBe(tokens.access_token);
      expect(newTokens.refresh_token).not.toBe(tokens.refresh_token);

      // Old refresh token should no longer work
      const replayRes = await app.request('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: 'recto_test',
        }).toString(),
      });

      expect(replayRes.status).toBe(400);
    });
  });

  it('rejects unsupported grant type', async () => {
    const app = createTestApp();
    const res = await app.request('/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }).toString(),
    });
    expect(res.status).toBe(400);
  });
});
