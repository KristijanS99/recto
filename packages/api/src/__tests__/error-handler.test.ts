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

const TEST_API_KEY = 'test-api-key';
const AUTH_HEADER = { Authorization: `Bearer ${TEST_API_KEY}` };

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
// ZodError / Validation error handler
// ============================================================================
describe('validation error handling', () => {
  it('returns 400 with useful error info for invalid entry body', async () => {
    const res = await jsonReq('/entries', { content: '' });
    expect(res.status).toBe(400);

    const body = await json(res);
    // The response should contain error information regardless of whether
    // @hono/zod-validator or the global ZodError handler catches it
    expect(body.error).toBeDefined();
    expect(typeof body.error.message).toBe('string');

    // If the global handler caught it, we get VALIDATION_ERROR with details
    // If zod-validator middleware caught it, we still get structured error info
    if (body.error.code === 'VALIDATION_ERROR') {
      expect(body.error.message).toBe('Request validation failed');
      expect(Array.isArray(body.error.details)).toBe(true);
      expect(body.error.details.length).toBeGreaterThanOrEqual(1);
      for (const detail of body.error.details) {
        expect(detail).toHaveProperty('path');
        expect(detail).toHaveProperty('message');
      }
    }
  });
});

// ============================================================================
// HTTPException handler (via auth middleware)
// ============================================================================
describe('HTTPException error handling', () => {
  it('returns structured error for missing auth on protected route', async () => {
    const res = await req('/entries');
    expect(res.status).toBe(401);

    const body = await json(res);
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe('string');
    expect(typeof body.error.message).toBe('string');
  });
});

// ============================================================================
// System routes bypass auth
// ============================================================================
describe('system routes bypass auth', () => {
  it('/health is accessible without auth and returns status ok', async () => {
    const res = await req('/health');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.status).toBe('ok');
  });

  it('/config is accessible without auth and exposes provider info', async () => {
    const res = await req('/config');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveProperty('llm_provider');
    expect(body).toHaveProperty('embedding_provider');
  });

  it('/config does not expose the API key', async () => {
    const res = await req('/config');
    const body = await json(res);
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain(TEST_API_KEY);
    expect(body).not.toHaveProperty('RECTO_API_KEY');
    expect(body).not.toHaveProperty('api_key');
  });
});
