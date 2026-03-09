import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import * as schema from '../db/schema.js';
import { prompts } from '../db/schema.js';
import { DEFAULT_PROMPTS } from '../db/seed.js';

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

beforeEach(async () => {
  await db.delete(prompts);
  for (const p of DEFAULT_PROMPTS) {
    await db.insert(prompts).values(p);
  }
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
// List prompts
// ============================================================================
describe('GET /prompts', () => {
  it('returns all 6 default prompts', async () => {
    const res = await req('/prompts', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toHaveLength(6);
    for (const p of body.data) {
      expect(p.isDefault).toBe(true);
    }
  });

  it('requires auth (401)', async () => {
    const res = await req('/prompts');
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Get single prompt
// ============================================================================
describe('GET /prompts/:id', () => {
  it('returns a single prompt', async () => {
    const listRes = await req('/prompts', { headers: AUTH_HEADER });
    const list = await json(listRes);
    const first = list.data[0];

    const res = await req(`/prompts/${first.id}`, { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toBe(first.id);
    expect(body.name).toBe(first.name);
    expect(body.content).toBe(first.content);
  });

  it('returns 404 for unknown id', async () => {
    const res = await req('/prompts/00000000-0000-0000-0000-000000000000', {
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// Create prompt
// ============================================================================
describe('POST /prompts', () => {
  it('creates a custom prompt with isDefault: false', async () => {
    const res = await jsonReq('/prompts', {
      name: 'my-custom-prompt',
      description: 'A custom prompt',
      content: 'Do something custom.',
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.name).toBe('my-custom-prompt');
    expect(body.description).toBe('A custom prompt');
    expect(body.content).toBe('Do something custom.');
    expect(body.isDefault).toBe(false);
  });

  it('rejects invalid slug name (400)', async () => {
    const res = await jsonReq('/prompts', {
      name: 'Invalid Name!',
      description: 'Bad slug',
      content: 'Some content.',
    });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Update prompt
// ============================================================================
describe('PUT /prompts/:id', () => {
  it('updates a prompt', async () => {
    const listRes = await req('/prompts', { headers: AUTH_HEADER });
    const list = await json(listRes);
    const target = list.data[0];

    const res = await jsonReq(
      `/prompts/${target.id}`,
      { description: 'Updated description', content: 'Updated content' },
      'PUT',
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toBe(target.id);
    expect(body.description).toBe('Updated description');
    expect(body.content).toBe('Updated content');
  });
});

// ============================================================================
// Delete prompt
// ============================================================================
describe('DELETE /prompts/:id', () => {
  it('deletes a custom prompt', async () => {
    // Create a custom prompt first
    const createRes = await jsonReq('/prompts', {
      name: 'to-delete',
      description: 'Will be deleted',
      content: 'Delete me.',
    });
    const created = await json(createRes);

    const res = await req(`/prompts/${created.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(200);

    // Verify it's gone
    const getRes = await req(`/prompts/${created.id}`, { headers: AUTH_HEADER });
    expect(getRes.status).toBe(404);
  });

  it('rejects deleting a default prompt (400)', async () => {
    const listRes = await req('/prompts', { headers: AUTH_HEADER });
    const list = await json(listRes);
    const defaultPrompt = list.data.find((p: { isDefault: boolean }) => p.isDefault);

    const res = await req(`/prompts/${defaultPrompt.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});

// ============================================================================
// Reset prompt
// ============================================================================
describe('POST /prompts/:id/reset', () => {
  it('restores default content after modification', async () => {
    const listRes = await req('/prompts', { headers: AUTH_HEADER });
    const list = await json(listRes);
    const target = list.data.find((p: { name: string }) => p.name === 'daily-checkin');

    // Modify the prompt
    await jsonReq(
      `/prompts/${target.id}`,
      { content: 'Modified content', description: 'Modified description' },
      'PUT',
    );

    // Reset it
    const resetRes = await req(`/prompts/${target.id}/reset`, {
      method: 'POST',
      headers: AUTH_HEADER,
    });
    expect(resetRes.status).toBe(200);
    const body = await json(resetRes);

    const original = DEFAULT_PROMPTS.find((p) => p.name === 'daily-checkin');
    expect(body.content).toBe(original!.content);
    expect(body.description).toBe(original!.description);
  });

  it('rejects resetting non-default prompt (400)', async () => {
    // Create a custom prompt
    const createRes = await jsonReq('/prompts', {
      name: 'custom-no-reset',
      description: 'Cannot reset',
      content: 'Not resettable.',
    });
    const created = await json(createRes);

    const res = await req(`/prompts/${created.id}/reset`, {
      method: 'POST',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});
