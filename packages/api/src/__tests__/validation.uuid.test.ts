import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import * as schema from '../db/schema.js';

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
// biome-ignore lint/suspicious/noExplicitAny: test helper
let db: any;
let app: ReturnType<typeof createApp>;

const TEST_API_KEY = 'test-api-key-that-is-at-least-32-chars-long';
const AUTH_HEADER = { Authorization: `Bearer ${TEST_API_KEY}` };
const INVALID_ID = 'not-a-uuid';

const testConfig: Config = {
  DATABASE_URL: '',
  RECTO_API_KEY: TEST_API_KEY,
  LLM_PROVIDER: 'none',
  ANTHROPIC_API_KEY: undefined,
  OPENAI_API_KEY: undefined,
  EMBEDDING_PROVIDER: 'none',
  EMBEDDING_DIMENSIONS: undefined,
  VOYAGE_API_KEY: undefined,
  OLLAMA_URL: undefined,
  OLLAMA_EMBEDDING_MODEL: 'nomic-embed-text',
  API_PORT: 3000,
  RECTO_ACCESS_TOKEN_TTL: 3600,
  RECTO_REFRESH_TOKEN_TTL: 7776000,
  embeddingDimensions: null,
};

beforeAll(async () => {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();
  client = postgres(container.getConnectionUri());
  db = drizzle(client, { schema });

  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(db, {
    migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
  });

  app = createApp(db, testConfig);
}, 60_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
}, 30_000);

function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

function jsonReq(path: string, body: unknown, method = 'POST') {
  return req(path, {
    method,
    headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper for untyped JSON
async function json(res: Response): Promise<any> {
  return res.json();
}

// ============================================================================
// UUID validation on entry routes
// ============================================================================
describe('UUID validation on entry routes', () => {
  it('GET /entries/:id returns 400 for invalid UUID', async () => {
    const res = await req(`/entries/${INVALID_ID}`, { headers: AUTH_HEADER });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toBe('Invalid ID format');
  });

  it('PATCH /entries/:id returns 400 for invalid UUID', async () => {
    const res = await jsonReq(`/entries/${INVALID_ID}`, { content: 'test' }, 'PATCH');
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('DELETE /entries/:id returns 400 for invalid UUID', async () => {
    const res = await req(`/entries/${INVALID_ID}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});

// ============================================================================
// UUID validation on tag routes
// ============================================================================
describe('UUID validation on tag routes', () => {
  it('POST /entries/:id/tags returns 400 for invalid UUID', async () => {
    const res = await jsonReq(`/entries/${INVALID_ID}/tags`, { tags: ['test'] });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('DELETE /entries/:id/tags returns 400 for invalid UUID', async () => {
    const res = await req(`/entries/${INVALID_ID}/tags`, {
      method: 'DELETE',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['test'] }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});

// ============================================================================
// UUID validation on media routes
// ============================================================================
describe('UUID validation on media routes', () => {
  it('POST /entries/:id/media returns 400 for invalid UUID', async () => {
    const res = await jsonReq(`/entries/${INVALID_ID}/media`, {
      type: 'image',
      url: 'https://example.com/photo.jpg',
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('DELETE /entries/:id/media/:index returns 400 for invalid UUID', async () => {
    const res = await req(`/entries/${INVALID_ID}/media/0`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});

// ============================================================================
// UUID validation on prompt routes
// ============================================================================
describe('UUID validation on prompt routes', () => {
  it('GET /prompts/:id returns 400 for invalid UUID', async () => {
    const res = await req(`/prompts/${INVALID_ID}`, { headers: AUTH_HEADER });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('PUT /prompts/:id returns 400 for invalid UUID', async () => {
    const res = await jsonReq(`/prompts/${INVALID_ID}`, { content: 'test' }, 'PUT');
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('DELETE /prompts/:id returns 400 for invalid UUID', async () => {
    const res = await req(`/prompts/${INVALID_ID}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('POST /prompts/:id/reset returns 400 for invalid UUID', async () => {
    const res = await req(`/prompts/${INVALID_ID}/reset`, {
      method: 'POST',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});
