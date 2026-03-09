import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Hono } from 'hono';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema.js';
import { accessTokens } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { generateRandomToken, hashToken } from '../services/oauth.js';

const API_KEY = 'test-api-key-123';

function createTestApp(apiKey: string, db?: Parameters<typeof authMiddleware>[1]) {
  const app = new Hono();
  app.use('/*', authMiddleware(apiKey, db));
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

describe('authMiddleware', () => {
  const app = createTestApp(API_KEY);

  it('returns 401 with missing Authorization header message when no header is provided', async () => {
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' },
    });
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: API_KEY },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  });

  it('returns 401 when Bearer token does not match the API key', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer wrong-key' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  });

  it('returns 401 for empty Bearer token', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer ' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  });

  it('allows request with correct Bearer token and returns 200', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('is case-sensitive for Bearer prefix (lowercase bearer returns 401)', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: `bearer ${API_KEY}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  });
});

describe('authMiddleware with OAuth tokens', () => {
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
  }, 60_000);

  afterAll(async () => {
    await client?.end();
    await container?.stop();
  }, 30_000);

  it('accepts a valid OAuth access token', async () => {
    const rawToken = generateRandomToken();
    await db.insert(accessTokens).values({
      token: hashToken(rawToken),
      clientId: 'test-client',
      scopes: [],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    });

    const app = createTestApp(API_KEY, db);
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${rawToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('rejects an expired OAuth access token', async () => {
    const rawToken = generateRandomToken();
    await db.insert(accessTokens).values({
      token: hashToken(rawToken),
      clientId: 'test-client',
      scopes: [],
      expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
    });

    const app = createTestApp(API_KEY, db);
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${rawToken}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  });

  it('still accepts the static API key when db is provided', async () => {
    const app = createTestApp(API_KEY, db);
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
