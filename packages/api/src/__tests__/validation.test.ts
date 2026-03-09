import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import * as schema from '../db/schema.js';
import { entries } from '../db/schema.js';

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
  await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
  app = createApp(db, testConfig);
}, 60_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
}, 30_000);

beforeEach(async () => {
  await db.delete(entries);
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

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function json(res: Response): Promise<any> {
  return res.json();
}

async function createEntry(content = 'test content') {
  const res = await jsonReq('/entries', { content });
  return json(res);
}

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

// ============================================================================
// POST /entries validation
// ============================================================================
describe('POST /entries validation', () => {
  it('rejects empty content string', async () => {
    const res = await jsonReq('/entries', { content: '' });
    expect(res.status).toBe(400);
  });

  it('rejects missing content field', async () => {
    const res = await jsonReq('/entries', { title: 'no content' });
    expect(res.status).toBe(400);
  });

  it('rejects non-string content', async () => {
    const res = await jsonReq('/entries', { content: 123 });
    expect(res.status).toBe(400);
  });

  it('rejects tags as non-array string', async () => {
    const res = await jsonReq('/entries', { content: 'hello', tags: 'not-an-array' });
    expect(res.status).toBe(400);
  });

  it('rejects null body', async () => {
    const res = await jsonReq('/entries', null);
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// PATCH /entries/:id validation
// ============================================================================
describe('PATCH /entries/:id validation', () => {
  it('rejects empty content on update', async () => {
    const entry = await createEntry();
    const res = await jsonReq(`/entries/${entry.id}`, { content: '' }, 'PATCH');
    expect(res.status).toBe(400);
  });

  it('accepts empty object update as no-op', async () => {
    const entry = await createEntry('original');
    const res = await jsonReq(`/entries/${entry.id}`, {}, 'PATCH');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.content).toBe('original');
  });
});

// ============================================================================
// GET /entries cursor validation
// ============================================================================
describe('GET /entries cursor validation', () => {
  it('returns 400 for garbage cursor (not base64)', async () => {
    const res = await req('/entries?cursor=!!!not-base64!!!', { headers: AUTH_HEADER });
    expect(res.status).toBe(400);
  });

  it('returns 400 for cursor missing pipe separator', async () => {
    const cursor = Buffer.from('no-pipe-here').toString('base64url');
    const res = await req(`/entries?cursor=${cursor}`, { headers: AUTH_HEADER });
    expect(res.status).toBe(400);
  });

  it('returns 400 for cursor with invalid date', async () => {
    const cursor = Buffer.from('not-a-date|some-id').toString('base64url');
    const res = await req(`/entries?cursor=${cursor}`, { headers: AUTH_HEADER });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// POST /entries/:id/tags validation
// ============================================================================
describe('POST /entries/:id/tags validation', () => {
  it('rejects empty tags array', async () => {
    const entry = await createEntry();
    const res = await jsonReq(`/entries/${entry.id}/tags`, { tags: [] });
    expect(res.status).toBe(400);
  });

  it('rejects tags with empty string elements', async () => {
    const entry = await createEntry();
    const res = await jsonReq(`/entries/${entry.id}/tags`, { tags: [''] });
    expect(res.status).toBe(400);
  });

  it('rejects missing tags field', async () => {
    const entry = await createEntry();
    const res = await jsonReq(`/entries/${entry.id}/tags`, {});
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent entry', async () => {
    const res = await jsonReq(`/entries/${FAKE_UUID}/tags`, { tags: ['hello'] });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// DELETE /entries/:id/tags validation
// ============================================================================
describe('DELETE /entries/:id/tags validation', () => {
  it('returns 404 for non-existent entry', async () => {
    const res = await req(`/entries/${FAKE_UUID}/tags`, {
      method: 'DELETE',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['hello'] }),
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// POST /entries/:id/media validation
// ============================================================================
describe('POST /entries/:id/media validation', () => {
  it('rejects invalid media type', async () => {
    const entry = await createEntry();
    const res = await jsonReq(`/entries/${entry.id}/media`, {
      type: 'pdf',
      url: 'https://example.com/file.pdf',
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid URL', async () => {
    const entry = await createEntry();
    const res = await jsonReq(`/entries/${entry.id}/media`, {
      type: 'image',
      url: 'not-a-url',
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing url field', async () => {
    const entry = await createEntry();
    const res = await jsonReq(`/entries/${entry.id}/media`, { type: 'image' });
    expect(res.status).toBe(400);
  });

  it('rejects missing type field', async () => {
    const entry = await createEntry();
    const res = await jsonReq(`/entries/${entry.id}/media`, {
      url: 'https://example.com/photo.jpg',
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent entry', async () => {
    const res = await jsonReq(`/entries/${FAKE_UUID}/media`, {
      type: 'image',
      url: 'https://example.com/photo.jpg',
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// DELETE /entries/:id/media/:index validation
// ============================================================================
describe('DELETE /entries/:id/media/:index validation', () => {
  it('returns 400 for negative index', async () => {
    const entry = await createEntry();
    const res = await req(`/entries/${entry.id}/media/-1`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric index', async () => {
    const entry = await createEntry();
    const res = await req(`/entries/${entry.id}/media/abc`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for index out of range', async () => {
    const entry = await createEntry();
    const res = await req(`/entries/${entry.id}/media/99`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// DELETE /entries/:id edge cases
// ============================================================================
describe('DELETE /entries/:id edge cases', () => {
  it('returns 404 for non-existent entry', async () => {
    const res = await req(`/entries/${FAKE_UUID}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(404);
  });
});
