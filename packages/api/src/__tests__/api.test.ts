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

// biome-ignore lint/suspicious/noExplicitAny: test helper for untyped JSON
async function json(res: Response): Promise<any> {
  return res.json();
}

// ============================================================================
// Auth
// ============================================================================
describe('auth middleware', () => {
  it('should return 401 without auth header', async () => {
    const res = await req('/entries');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid key', async () => {
    const res = await req('/entries', {
      headers: { Authorization: 'Bearer wrong-key' },
    });
    expect(res.status).toBe(401);
  });

  it('should allow requests with valid key', async () => {
    const res = await req('/entries', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
  });

  it('should allow /health without auth', async () => {
    const res = await req('/health');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe('ok');
  });
});

// ============================================================================
// System routes
// ============================================================================
describe('system routes', () => {
  it('GET /health returns status and version', async () => {
    const res = await req('/health');
    const body = await json(res);
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /config returns provider info (requires auth)', async () => {
    const res = await req('/config', { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.llm_provider).toBe('none');
    expect(body.embedding_provider).toBe('none');
    expect(body.embedding_dimensions).toBeNull();
  });
});

// ============================================================================
// Entry CRUD
// ============================================================================
describe('entry CRUD', () => {
  it('POST /entries creates an entry', async () => {
    const res = await jsonReq('/entries', {
      content: 'Hello journal',
      title: 'My first entry',
      tags: ['test'],
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.content).toBe('Hello journal');
    expect(body.title).toBe('My first entry');
    expect(body.tags).toEqual(['test']);
    expect(body.id).toBeTruthy();
  });

  it('POST /entries requires content', async () => {
    const res = await jsonReq('/entries', { title: 'no content' });
    expect(res.status).toBe(400);
  });

  it('GET /entries/:id returns a single entry', async () => {
    const createRes = await jsonReq('/entries', { content: 'test entry' });
    const created = await json(createRes);

    const res = await req(`/entries/${created.id}`, { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.content).toBe('test entry');
  });

  it('GET /entries/:id returns 404 for missing entry', async () => {
    const res = await req('/entries/00000000-0000-0000-0000-000000000000', {
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(404);
  });

  it('PATCH /entries/:id updates an entry', async () => {
    const createRes = await jsonReq('/entries', { content: 'original' });
    const created = await json(createRes);

    const res = await jsonReq(
      `/entries/${created.id}`,
      { content: 'updated', mood: 'happy' },
      'PATCH',
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.content).toBe('updated');
    expect(body.mood).toBe('happy');
  });

  it('PATCH /entries/:id returns 404 for missing entry', async () => {
    const res = await jsonReq(
      '/entries/00000000-0000-0000-0000-000000000000',
      { content: 'nope' },
      'PATCH',
    );
    expect(res.status).toBe(404);
  });

  it('DELETE /entries/:id deletes an entry', async () => {
    const createRes = await jsonReq('/entries', { content: 'to delete' });
    const created = await json(createRes);

    const res = await req(`/entries/${created.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(200);

    const getRes = await req(`/entries/${created.id}`, { headers: AUTH_HEADER });
    expect(getRes.status).toBe(404);
  });
});

// ============================================================================
// Pagination
// ============================================================================
describe('pagination', () => {
  it('returns paginated results with cursor', async () => {
    // Create 5 entries with slight time separation
    for (let i = 0; i < 5; i++) {
      await jsonReq('/entries', { content: `Entry ${i}` });
    }

    // Get first page (limit 2)
    const res1 = await req('/entries?limit=2', { headers: AUTH_HEADER });
    const page1 = await json(res1);
    expect(page1.data).toHaveLength(2);
    expect(page1.has_more).toBe(true);
    expect(page1.next_cursor).toBeTruthy();

    // Get second page
    const res2 = await req(`/entries?limit=2&cursor=${page1.next_cursor}`, {
      headers: AUTH_HEADER,
    });
    const page2 = await json(res2);
    expect(page2.data).toHaveLength(2);
    expect(page2.has_more).toBe(true);

    // Get last page
    const res3 = await req(`/entries?limit=2&cursor=${page2.next_cursor}`, {
      headers: AUTH_HEADER,
    });
    const page3 = await json(res3);
    expect(page3.data).toHaveLength(1);
    expect(page3.has_more).toBe(false);
    expect(page3.next_cursor).toBeNull();
  });

  it('returns entries in descending created_at order', async () => {
    await jsonReq('/entries', { content: 'First' });
    await jsonReq('/entries', { content: 'Second' });

    const res = await req('/entries', { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.data[0].content).toBe('Second');
    expect(body.data[1].content).toBe('First');
  });
});

// ============================================================================
// Filters
// ============================================================================
describe('filters', () => {
  it('filters by tag', async () => {
    await jsonReq('/entries', { content: 'tagged', tags: ['work'] });
    await jsonReq('/entries', { content: 'not tagged', tags: ['personal'] });

    const res = await req('/entries?tag=work', { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe('tagged');
  });

  it('filters by people', async () => {
    await jsonReq('/entries', { content: 'with alice', people: ['Alice'] });
    await jsonReq('/entries', { content: 'with bob', people: ['Bob'] });

    const res = await req('/entries?people=Alice', { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe('with alice');
  });

  it('filters by date range', async () => {
    await jsonReq('/entries', { content: 'recent entry' });

    const past = new Date('2020-01-01T00:00:00Z').toISOString();
    const future = new Date('2099-01-01T00:00:00Z').toISOString();

    const res = await req(`/entries?from=${past}&to=${future}`, { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Tags
// ============================================================================
describe('tag operations', () => {
  it('GET /tags returns tags with counts', async () => {
    await jsonReq('/entries', { content: 'a', tags: ['work', 'coding'] });
    await jsonReq('/entries', { content: 'b', tags: ['work', 'meetings'] });

    const res = await req('/tags', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const body = await json(res);

    const workTag = body.data.find((t: { tag: string }) => t.tag === 'work');
    expect(workTag).toBeDefined();
    expect(workTag.count).toBe(2);
  });

  it('POST /entries/:id/tags adds tags', async () => {
    const createRes = await jsonReq('/entries', { content: 'test', tags: ['a'] });
    const created = await json(createRes);

    const res = await jsonReq(`/entries/${created.id}/tags`, { tags: ['b', 'c'] });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.tags).toEqual(['a', 'b', 'c']);
  });

  it('DELETE /entries/:id/tags removes tags', async () => {
    const createRes = await jsonReq('/entries', { content: 'test', tags: ['a', 'b', 'c'] });
    const created = await json(createRes);

    const res = await req(`/entries/${created.id}/tags`, {
      method: 'DELETE',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['b'] }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.tags).toEqual(['a', 'c']);
  });
});

// ============================================================================
// Media
// ============================================================================
describe('media operations', () => {
  it('POST /entries/:id/media adds media', async () => {
    const createRes = await jsonReq('/entries', { content: 'test' });
    const created = await json(createRes);

    const res = await jsonReq(`/entries/${created.id}/media`, {
      type: 'image',
      url: 'https://example.com/photo.jpg',
      caption: 'A photo',
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.media).toHaveLength(1);
    expect(body.media[0].url).toBe('https://example.com/photo.jpg');
  });

  it('DELETE /entries/:id/media/:index removes media', async () => {
    const createRes = await jsonReq('/entries', { content: 'test' });
    const created = await json(createRes);

    // Add two media items
    await jsonReq(`/entries/${created.id}/media`, {
      type: 'image',
      url: 'https://example.com/a.jpg',
    });
    await jsonReq(`/entries/${created.id}/media`, {
      type: 'link',
      url: 'https://example.com/b',
    });

    // Delete first one
    const res = await req(`/entries/${created.id}/media/0`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.media).toHaveLength(1);
    expect(body.media[0].url).toBe('https://example.com/b');
  });

  it('returns 404 for invalid media index', async () => {
    const createRes = await jsonReq('/entries', { content: 'test' });
    const created = await json(createRes);

    const res = await req(`/entries/${created.id}/media/99`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(404);
  });
});
