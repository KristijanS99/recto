import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Hono } from 'hono';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema.js';
import { oauthClients } from '../db/schema.js';
import { oauthRoutes } from '../routes/oauth.js';

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
// biome-ignore lint/suspicious/noExplicitAny: test helper
let db: any;
const testClientId = 'recto_test_client';
const API_KEY = 'test-api-key';

beforeAll(async () => {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();
  client = postgres(container.getConnectionUri());
  db = drizzle(client, { schema });

  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(db, {
    migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
  });

  await db.insert(oauthClients).values({
    clientId: testClientId,
    clientName: 'Test Client',
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
    }),
  );
}

describe('GET /authorize', () => {
  it('renders consent screen for valid request', async () => {
    const app = createTestApp();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: testClientId,
      redirect_uri: 'http://localhost:3000/callback',
      state: 'random-state',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
    });

    const res = await app.request(`/authorize?${params}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Test Client');
    expect(html).toContain('API key');
  });

  it('rejects unknown client_id', async () => {
    const app = createTestApp();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: 'unknown',
      redirect_uri: 'http://localhost:3000/callback',
      state: 'random-state',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    });
    const res = await app.request(`/authorize?${params}`);
    expect(res.status).toBe(400);
  });

  it('rejects mismatched redirect_uri', async () => {
    const app = createTestApp();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: testClientId,
      redirect_uri: 'http://localhost:9999/evil',
      state: 'random-state',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    });
    const res = await app.request(`/authorize?${params}`);
    expect(res.status).toBe(400);
  });

  it('rejects missing required params', async () => {
    const app = createTestApp();
    const params = new URLSearchParams({
      client_id: testClientId,
    });
    const res = await app.request(`/authorize?${params}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /authorize', () => {
  it('issues authorization code for valid API key', async () => {
    const app = createTestApp();
    const res = await app.request('/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: testClientId,
        redirect_uri: 'http://localhost:3000/callback',
        state: 'random-state',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
        api_key: API_KEY,
      }).toString(),
    });

    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    const redirectUrl = new URL(location);
    expect(redirectUrl.origin).toBe('http://localhost:3000');
    expect(redirectUrl.pathname).toBe('/callback');
    expect(redirectUrl.searchParams.get('code')).toBeTruthy();
    expect(redirectUrl.searchParams.get('state')).toBe('random-state');
  });

  it('rejects invalid API key', async () => {
    const app = createTestApp();
    const res = await app.request('/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: testClientId,
        redirect_uri: 'http://localhost:3000/callback',
        state: 'random-state',
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        api_key: 'wrong-key',
      }).toString(),
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Invalid API key');
  });

  it('rejects unknown client_id', async () => {
    const app = createTestApp();
    const res = await app.request('/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'unknown',
        redirect_uri: 'http://localhost:3000/callback',
        state: 'random-state',
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        api_key: API_KEY,
      }).toString(),
    });

    expect(res.status).toBe(400);
  });
});
