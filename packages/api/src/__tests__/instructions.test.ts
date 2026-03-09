import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import * as schema from '../db/schema.js';
import { instructions } from '../db/schema.js';
import { DEFAULT_INSTRUCTIONS } from '../db/seed.js';

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
// biome-ignore lint/suspicious/noExplicitAny: test helper
let db: any;
let app: ReturnType<typeof createApp>;

const TEST_API_KEY = 'test-api-key-that-is-at-least-32-chars-long';
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

beforeEach(async () => {
  await db.delete(instructions);
  await db.insert(instructions).values({ content: DEFAULT_INSTRUCTIONS });
});

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
// Instructions
// ============================================================================
describe('instructions endpoints', () => {
  it('GET /instructions returns seeded default', async () => {
    const res = await req('/instructions', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.content).toBe(DEFAULT_INSTRUCTIONS);
    expect(body.id).toBeTruthy();
    expect(body.updatedAt).toBeTruthy();
  });

  it('GET /instructions requires auth (401)', async () => {
    const res = await req('/instructions');
    expect(res.status).toBe(401);
  });

  it('PUT /instructions updates content', async () => {
    const newContent = 'You are a custom journaling assistant.';
    const res = await jsonReq('/instructions', { content: newContent }, 'PUT');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.content).toBe(newContent);

    // Verify the update persisted
    const getRes = await req('/instructions', { headers: AUTH_HEADER });
    const getBody = await json(getRes);
    expect(getBody.content).toBe(newContent);
  });

  it('PUT /instructions rejects empty content (400)', async () => {
    const res = await jsonReq('/instructions', { content: '' }, 'PUT');
    expect(res.status).toBe(400);
  });

  it('POST /instructions/reset restores default after modification', async () => {
    // First, modify the instructions
    const customContent = 'Custom instructions that will be reset.';
    const updateRes = await jsonReq('/instructions', { content: customContent }, 'PUT');
    expect(updateRes.status).toBe(200);
    const updated = await json(updateRes);
    expect(updated.content).toBe(customContent);

    // Reset to default
    const resetRes = await req('/instructions/reset', {
      method: 'POST',
      headers: AUTH_HEADER,
    });
    expect(resetRes.status).toBe(200);
    const resetBody = await json(resetRes);
    expect(resetBody.content).toBe(DEFAULT_INSTRUCTIONS);

    // Verify the reset persisted
    const getRes = await req('/instructions', { headers: AUTH_HEADER });
    const getBody = await json(getRes);
    expect(getBody.content).toBe(DEFAULT_INSTRUCTIONS);
  });
});
