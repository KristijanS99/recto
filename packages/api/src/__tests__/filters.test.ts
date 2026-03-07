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

async function createEntry(opts: {
  content: string;
  tags?: string[];
  people?: string[];
  mood?: string;
}) {
  const res = await jsonReq('/entries', opts);
  return json(res);
}

// ============================================================================
// Combined filters
// ============================================================================
describe('combined filters', () => {
  it('filters by tag AND people simultaneously', async () => {
    await createEntry({ content: 'match both', tags: ['work'], people: ['Alice'] });
    await createEntry({ content: 'tag only', tags: ['work'], people: ['Bob'] });
    await createEntry({ content: 'people only', tags: ['personal'], people: ['Alice'] });

    const res = await req('/entries?tag=work&people=Alice', { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe('match both');
  });

  it('filters by tag AND date range', async () => {
    await createEntry({ content: 'tagged recent', tags: ['dev'] });
    await createEntry({ content: 'other tag', tags: ['ops'] });

    const past = new Date('2020-01-01T00:00:00Z').toISOString();
    const future = new Date('2099-01-01T00:00:00Z').toISOString();

    const res = await req(`/entries?tag=dev&from=${past}&to=${future}`, {
      headers: AUTH_HEADER,
    });
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe('tagged recent');
  });
});

// ============================================================================
// Pagination edge cases
// ============================================================================
describe('pagination edge cases', () => {
  it('returns empty data when no entries exist', async () => {
    const res = await req('/entries', { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.data).toEqual([]);
    expect(body.has_more).toBe(false);
    expect(body.next_cursor).toBeNull();
  });

  it('works with limit=1', async () => {
    await createEntry({ content: 'first' });
    await createEntry({ content: 'second' });

    const res = await req('/entries?limit=1', { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.has_more).toBe(true);
    expect(body.next_cursor).toBeTruthy();
  });

  it('returns all entries when limit exceeds total', async () => {
    await createEntry({ content: 'only one' });

    const res = await req('/entries?limit=100', { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.has_more).toBe(false);
    expect(body.next_cursor).toBeNull();
  });

  it('paginates through all entries correctly', async () => {
    // Create 5 entries sequentially
    for (let i = 0; i < 5; i++) {
      await createEntry({ content: `entry-${i}` });
    }

    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const allEntries: any[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const url = cursor ? `/entries?limit=2&cursor=${cursor}` : '/entries?limit=2';
      const res = await req(url, { headers: AUTH_HEADER });
      const body = await json(res);

      allEntries.push(...body.data);
      cursor = body.next_cursor;
      pages++;

      if (cursor) {
        expect(body.has_more).toBe(true);
      }
    } while (cursor);

    expect(pages).toBe(3);
    expect(allEntries).toHaveLength(5);

    // Verify reverse chronological order (newest first)
    for (let i = 0; i < allEntries.length - 1; i++) {
      const current = new Date(allEntries[i].createdAt).getTime();
      const next = new Date(allEntries[i + 1].createdAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });
});

// ============================================================================
// Tag operations
// ============================================================================
describe('tag operations - edge cases', () => {
  it('deduplicates when adding existing tags', async () => {
    const entry = await createEntry({ content: 'test', tags: ['work', 'coding'] });

    const res = await jsonReq(`/entries/${entry.id}/tags`, { tags: ['work', 'new'] });
    const body = await json(res);
    expect(body.tags).toEqual(['coding', 'new', 'work']);
  });

  it('removes specified tags and preserves others', async () => {
    const entry = await createEntry({ content: 'test', tags: ['a', 'b', 'c'] });

    const res = await req(`/entries/${entry.id}/tags`, {
      method: 'DELETE',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['b'] }),
    });
    const body = await json(res);
    expect(body.tags).toEqual(['a', 'c']);
  });

  it('removing tags not in entry is a no-op', async () => {
    const entry = await createEntry({ content: 'test', tags: ['a'] });

    const res = await req(`/entries/${entry.id}/tags`, {
      method: 'DELETE',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['nonexistent'] }),
    });
    const body = await json(res);
    expect(body.tags).toEqual(['a']);
  });
});

// ============================================================================
// GET /tags aggregation
// ============================================================================
describe('GET /tags aggregation', () => {
  it('returns empty when no entries have tags', async () => {
    await createEntry({ content: 'no tags' });

    const res = await req('/tags', { headers: AUTH_HEADER });
    const body = await json(res);
    expect(body.data).toEqual([]);
  });

  it('returns tags ordered by count DESC, then tag ASC', async () => {
    await createEntry({ content: 'a', tags: ['alpha', 'beta'] });
    await createEntry({ content: 'b', tags: ['alpha', 'gamma'] });
    await createEntry({ content: 'c', tags: ['alpha'] });

    const res = await req('/tags', { headers: AUTH_HEADER });
    const body = await json(res);

    // alpha=3, beta=1, gamma=1
    expect(body.data).toHaveLength(3);
    expect(body.data[0]).toEqual({ tag: 'alpha', count: 3 });
    // beta and gamma both have count=1, ordered by tag ASC
    expect(body.data[1]).toEqual({ tag: 'beta', count: 1 });
    expect(body.data[2]).toEqual({ tag: 'gamma', count: 1 });
  });
});
