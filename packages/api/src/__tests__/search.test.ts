import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import * as schema from '../db/schema.js';
import { entries } from '../db/schema.js';
import type { EmbeddingProvider } from '../services/embedding.js';
import { rrf } from '../services/search.js';

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

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function json(res: Response): Promise<any> {
  return res.json();
}

// ============================================================================
// RRF unit tests
// ============================================================================
describe('rrf (Reciprocal Rank Fusion)', () => {
  it('merges two ranked lists correctly', () => {
    const list1 = [
      { id: 'a', score: 1.0 },
      { id: 'b', score: 0.8 },
      { id: 'c', score: 0.6 },
    ];
    const list2 = [
      { id: 'b', score: 1.0 },
      { id: 'c', score: 0.8 },
      { id: 'd', score: 0.6 },
    ];

    const scores = rrf([list1, list2]);

    // b appears in both lists (rank 1 in list1, rank 0 in list2)
    // so it should have the highest combined score
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    expect(sorted[0]![0]).toBe('b');

    // All 4 unique IDs should be present
    expect(scores.size).toBe(4);
  });

  it('handles single list', () => {
    const list = [
      { id: 'x', score: 1.0 },
      { id: 'y', score: 0.5 },
    ];

    const scores = rrf([list]);
    expect(scores.size).toBe(2);
    // x is rank 0, y is rank 1 — x should have higher score
    expect(scores.get('x')!).toBeGreaterThan(scores.get('y')!);
  });

  it('handles empty lists', () => {
    const scores = rrf([[], []]);
    expect(scores.size).toBe(0);
  });
});

// ============================================================================
// Keyword search (BM25)
// ============================================================================
describe('keyword search', () => {
  it('finds entries by content keyword', async () => {
    await jsonReq('/entries', { content: 'I went hiking in the mountains today' });
    await jsonReq('/entries', { content: 'Had a great meeting at work' });
    await jsonReq('/entries', { content: 'Mountain climbing is my favorite hobby' });

    const res = await req('/search?q=mountain', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.mode_used).toBe('keyword');
    expect(body.results.length).toBeGreaterThanOrEqual(1);

    // All results should mention mountain/mountains
    for (const r of body.results) {
      const text = `${r.entry.content} ${r.entry.title ?? ''}`.toLowerCase();
      expect(text).toMatch(/mountain/);
    }
  });

  it('returns highlights with <mark> tags', async () => {
    await jsonReq('/entries', { content: 'The quick brown fox jumps over the lazy dog' });

    const res = await req('/search?q=fox', { headers: AUTH_HEADER });
    const body = await json(res);

    expect(body.results.length).toBe(1);
    expect(body.results[0].highlights).toBeDefined();
    expect(body.results[0].highlights[0]).toContain('<mark>');
  });

  it('searches title and content combined', async () => {
    await jsonReq('/entries', { content: 'nothing special', title: 'Astronomy notes' });

    const res = await req('/search?q=astronomy', { headers: AUTH_HEADER });
    const body = await json(res);

    expect(body.results.length).toBe(1);
    expect(body.results[0].entry.title).toBe('Astronomy notes');
  });

  it('returns empty results for non-matching query', async () => {
    await jsonReq('/entries', { content: 'Hello world' });

    const res = await req('/search?q=xyznonexistent', { headers: AUTH_HEADER });
    const body = await json(res);

    expect(body.results).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('supports websearch syntax (AND, OR, quotes)', async () => {
    await jsonReq('/entries', { content: 'I love cooking Italian pasta' });
    await jsonReq('/entries', { content: 'I love cooking French cuisine' });

    const res = await req('/search?q=cooking+Italian', { headers: AUTH_HEADER });
    const body = await json(res);

    // Should find at least the Italian entry
    expect(body.results.length).toBeGreaterThanOrEqual(1);
  });

  it('requires q parameter', async () => {
    const res = await req('/search', { headers: AUTH_HEADER });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Search filters
// ============================================================================
describe('search filters', () => {
  it('filters by tag', async () => {
    await jsonReq('/entries', { content: 'work project update', tags: ['work'] });
    await jsonReq('/entries', { content: 'personal project update', tags: ['personal'] });

    const res = await req('/search?q=project&tag=work', { headers: AUTH_HEADER });
    const body = await json(res);

    expect(body.results).toHaveLength(1);
    expect(body.results[0].entry.tags).toContain('work');
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await jsonReq('/entries', { content: `Programming tutorial number ${i}` });
    }

    const res = await req('/search?q=programming&limit=2', { headers: AUTH_HEADER });
    const body = await json(res);

    expect(body.results.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// Semantic search mode errors
// ============================================================================
describe('semantic search without provider', () => {
  it('returns 400 when semantic mode requested without embedding provider', async () => {
    const res = await req('/search?q=test&mode=semantic', { headers: AUTH_HEADER });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('falls back to keyword when hybrid mode with no embedding provider', async () => {
    await jsonReq('/entries', { content: 'Testing hybrid fallback behavior' });

    const res = await req('/search?q=hybrid+fallback&mode=hybrid', { headers: AUTH_HEADER });
    const body = await json(res);

    // Should gracefully fall back to keyword
    expect(body.mode_used).toBe('keyword');
  });
});

// ============================================================================
// Semantic search with mock provider
// ============================================================================
describe('semantic search with mock embedding', () => {
  // biome-ignore lint/suspicious/noExplicitAny: test override
  let semanticApp: any;

  const mockEmbedding: EmbeddingProvider = {
    dimensions: 1536,
    embed: async () => new Array(1536).fill(0.1),
    embedBatch: async (texts) => texts.map(() => new Array(1536).fill(0.1)),
  };

  beforeAll(() => {
    semanticApp = createApp(db, testConfig, mockEmbedding);
  });

  it('performs semantic search when provider is available', async () => {
    // Insert an entry with an embedding
    const embedding = new Array(1536).fill(0.1);
    await client`
      INSERT INTO entries (content, embedding)
      VALUES ('Semantic search test entry', ${JSON.stringify(embedding)}::vector)
    `;

    const res = await semanticApp.request('/search?q=semantic+test&mode=semantic', {
      headers: AUTH_HEADER,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode_used).toBe('semantic');
    expect(body.results.length).toBeGreaterThanOrEqual(1);
  });

  it('performs hybrid search combining keyword and semantic', async () => {
    // Insert entries — one with embedding, one without
    const embedding = new Array(1536).fill(0.1);
    await client`
      INSERT INTO entries (content, title, embedding)
      VALUES ('Deep learning research paper', 'AI Research', ${JSON.stringify(embedding)}::vector)
    `;
    await client`
      INSERT INTO entries (content, title)
      VALUES ('Machine learning research notes', 'ML Notes')
    `;

    const res = await semanticApp.request('/search?q=research&mode=hybrid', {
      headers: AUTH_HEADER,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode_used).toBe('hybrid');
    expect(body.results.length).toBeGreaterThanOrEqual(1);
  });
});
