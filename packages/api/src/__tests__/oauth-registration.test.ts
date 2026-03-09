import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Hono } from 'hono';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema.js';
import { oauthRoutes } from '../routes/oauth.js';

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

function createTestApp() {
  const app = new Hono();
  app.route('/', oauthRoutes({ issuerUrl: 'https://recto.example.com', db }));
  return app;
}

describe('POST /register', () => {
  it('registers a public client', async () => {
    const app = createTestApp();
    const res = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Test MCP Client',
        redirect_uris: ['http://localhost:3000/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.client_id).toMatch(/^recto_/);
    expect(body.client_name).toBe('Test MCP Client');
    expect(body.redirect_uris).toEqual(['http://localhost:3000/callback']);
    expect(body.token_endpoint_auth_method).toBe('none');
    expect(body.client_secret).toBeUndefined();
  });

  it('registers a confidential client with a secret', async () => {
    const app = createTestApp();
    const res = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Confidential Client',
        redirect_uris: ['https://app.example.com/callback'],
        token_endpoint_auth_method: 'client_secret_post',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.client_id).toMatch(/^recto_/);
    expect(body.client_secret).toMatch(/^recto_secret_/);
  });

  it('rejects registration without redirect_uris', async () => {
    const app = createTestApp();
    const res = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Bad Client' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects non-localhost HTTP redirect URIs', async () => {
    const app = createTestApp();
    const res = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Bad Redirect',
        redirect_uris: ['http://evil.com/callback'],
      }),
    });
    expect(res.status).toBe(400);
  });
});
