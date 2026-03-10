import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import * as schema from '../db/schema.js';
import { entries } from '../db/schema.js';
import type { EmbeddingProvider } from '../services/embedding.js';
import { enrichEntry, mergeTags } from '../services/enrichment.js';
import {
  type EnrichmentResult,
  type LLMProvider,
  NullLLM,
  parseEnrichmentResponse,
} from '../services/llm.js';

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
// biome-ignore lint/suspicious/noExplicitAny: test helper
let db: any;

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
}, 60_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
}, 30_000);

beforeEach(async () => {
  await db.delete(entries);
});

// ============================================================================
// parseEnrichmentResponse
// ============================================================================
describe('parseEnrichmentResponse', () => {
  it('parses a valid JSON response', () => {
    const result = parseEnrichmentResponse(
      '{"title": "Morning Run", "tags": ["fitness", "running"], "mood": "energetic", "people": ["Alice"]}',
    );
    expect(result.title).toBe('Morning Run');
    expect(result.tags).toEqual(['fitness', 'running']);
    expect(result.mood).toBe('energetic');
    expect(result.people).toEqual(['Alice']);
  });

  it('extracts JSON from markdown code blocks', () => {
    const result = parseEnrichmentResponse(
      'Here is the result:\n```json\n{"title": "Test", "tags": ["a"], "mood": "happy", "people": []}\n```',
    );
    expect(result.title).toBe('Test');
  });

  it('lowercases tags and mood', () => {
    const result = parseEnrichmentResponse(
      '{"title": "Test", "tags": ["Work", "CODING"], "mood": "Happy", "people": []}',
    );
    expect(result.tags).toEqual(['work', 'coding']);
    expect(result.mood).toBe('happy');
  });

  it('handles missing fields gracefully', () => {
    const result = parseEnrichmentResponse('{}');
    expect(result.title).toBe('Untitled');
    expect(result.tags).toEqual([]);
    expect(result.mood).toBeNull();
    expect(result.people).toEqual([]);
  });

  it('throws on non-JSON response', () => {
    expect(() => parseEnrichmentResponse('No JSON here')).toThrow('No JSON found');
  });
});

// ============================================================================
// mergeTags
// ============================================================================
describe('mergeTags', () => {
  it('merges and deduplicates tags', () => {
    const result = mergeTags(['work', 'coding'], ['coding', 'meeting']);
    expect(result).toEqual(['coding', 'meeting', 'work']);
  });

  it('lowercases all tags', () => {
    const result = mergeTags(['Work'], ['CODING']);
    expect(result).toEqual(['coding', 'work']);
  });

  it('handles empty arrays', () => {
    expect(mergeTags([], [])).toEqual([]);
    expect(mergeTags(['a'], [])).toEqual(['a']);
    expect(mergeTags([], ['b'])).toEqual(['b']);
  });

  it('sorts alphabetically', () => {
    const result = mergeTags(['zebra'], ['alpha', 'beta']);
    expect(result).toEqual(['alpha', 'beta', 'zebra']);
  });
});

// ============================================================================
// enrichEntry integration
// ============================================================================
describe('enrichEntry', () => {
  const mockLLM: LLMProvider = {
    async enrich(): Promise<EnrichmentResult> {
      return {
        title: 'AI Generated Title',
        tags: ['ai-tag', 'generated'],
        mood: 'reflective',
        people: ['Bob'],
      };
    },
    async generate(): Promise<string> {
      return '';
    },
  };

  const mockEmbedding: EmbeddingProvider = {
    dimensions: 1536,
    embed: async () => new Array(1536).fill(0.01),
    embedBatch: async (texts) => texts.map(() => new Array(1536).fill(0.01)),
  };

  const nullEmbedding: EmbeddingProvider = {
    dimensions: 0,
    embed: async () => [],
    embedBatch: async (texts) => texts.map(() => []),
  };

  it('enriches an entry with LLM-generated metadata', async () => {
    const [entry] = await db
      .insert(entries)
      .values({ content: 'Had a great day coding with Bob' })
      .returning();

    await enrichEntry(db, mockLLM, nullEmbedding, entry!.id);

    const [updated] = await db.select().from(entries).where(eq(entries.id, entry!.id));
    expect(updated!.title).toBe('AI Generated Title');
    expect(updated!.tags).toContain('ai-tag');
    expect(updated!.tags).toContain('generated');
    expect(updated!.mood).toBe('reflective');
    expect(updated!.people).toContain('Bob');
  });

  it('preserves user-provided title', async () => {
    const [entry] = await db
      .insert(entries)
      .values({ content: 'Some content', title: 'My Title' })
      .returning();

    await enrichEntry(db, mockLLM, nullEmbedding, entry!.id);

    const [updated] = await db.select().from(entries).where(eq(entries.id, entry!.id));
    expect(updated!.title).toBe('My Title');
  });

  it('merges AI tags with existing user tags', async () => {
    const [entry] = await db
      .insert(entries)
      .values({ content: 'Some content', tags: ['user-tag'] })
      .returning();

    await enrichEntry(db, mockLLM, nullEmbedding, entry!.id);

    const [updated] = await db.select().from(entries).where(eq(entries.id, entry!.id));
    expect(updated!.tags).toContain('user-tag');
    expect(updated!.tags).toContain('ai-tag');
    expect(updated!.tags).toContain('generated');
  });

  it('generates embeddings when provider is available', async () => {
    const [entry] = await db
      .insert(entries)
      .values({ content: 'Some content to embed' })
      .returning();

    await enrichEntry(db, new NullLLM(), mockEmbedding, entry!.id);

    const [updated] = await db.select().from(entries).where(eq(entries.id, entry!.id));
    expect(updated!.embedding).toBeTruthy();
  });

  it('runs LLM and embedding in parallel', async () => {
    const [entry] = await db
      .insert(entries)
      .values({ content: 'Test parallel enrichment' })
      .returning();

    await enrichEntry(db, mockLLM, mockEmbedding, entry!.id);

    const [updated] = await db.select().from(entries).where(eq(entries.id, entry!.id));
    expect(updated!.title).toBe('AI Generated Title');
    expect(updated!.embedding).toBeTruthy();
  });

  it('handles LLM failure gracefully', async () => {
    const failingLLM: LLMProvider = {
      async enrich(): Promise<EnrichmentResult> {
        throw new Error('LLM API down');
      },
      async generate(): Promise<string> {
        throw new Error('LLM API down');
      },
    };

    const [entry] = await db
      .insert(entries)
      .values({ content: 'Test failure handling' })
      .returning();

    // Should not throw
    await enrichEntry(db, failingLLM, mockEmbedding, entry!.id);

    // Embedding should still be set even though LLM failed
    const [updated] = await db.select().from(entries).where(eq(entries.id, entry!.id));
    expect(updated!.embedding).toBeTruthy();
  });

  it('does nothing with NullLLM and NullEmbedding', async () => {
    const [entry] = await db
      .insert(entries)
      .values({ content: 'Test no-op enrichment' })
      .returning();

    await enrichEntry(db, new NullLLM(), nullEmbedding, entry!.id);

    const [updated] = await db.select().from(entries).where(eq(entries.id, entry!.id));
    expect(updated!.title).toBeNull();
    expect(updated!.embedding).toBeNull();
  });
});

// ============================================================================
// Enrichment triggered via API
// ============================================================================
describe('enrichment via API', () => {
  const mockLLM: LLMProvider = {
    async enrich(): Promise<EnrichmentResult> {
      return {
        title: 'Auto Title',
        tags: ['auto'],
        mood: 'calm',
        people: [],
      };
    },
    async generate(): Promise<string> {
      return '';
    },
  };

  it('triggers enrichment on entry creation', async () => {
    const app = createApp(db, testConfig, { llmProvider: mockLLM });

    const res = await app.request('/entries', {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'A new journal entry' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();

    // Wait for fire-and-forget enrichment to complete
    await new Promise((r) => setTimeout(r, 200));

    const getRes = await app.request(`/entries/${(body as { id: string }).id}`, {
      headers: AUTH_HEADER,
    });
    const updated = await getRes.json();
    expect((updated as { title: string }).title).toBe('Auto Title');
    expect((updated as { tags: string[] }).tags).toContain('auto');
  });

  it('re-enriches on content update', async () => {
    let callCount = 0;
    const countingLLM: LLMProvider = {
      async enrich(): Promise<EnrichmentResult> {
        callCount++;
        return { title: `Title v${callCount}`, tags: [], mood: null, people: [] };
      },
      async generate(): Promise<string> {
        return '';
      },
    };

    const app = createApp(db, testConfig, { llmProvider: countingLLM });

    // Create entry
    const createRes = await app.request('/entries', {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Original content' }),
    });
    const created = (await createRes.json()) as { id: string };
    await new Promise((r) => setTimeout(r, 200));

    // Update content
    await app.request(`/entries/${created.id}`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated content' }),
    });
    await new Promise((r) => setTimeout(r, 200));

    expect(callCount).toBe(2);
  });

  it('entry creation succeeds even when enrichment is disabled', async () => {
    const app = createApp(db, testConfig);

    const res = await app.request('/entries', {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'No enrichment here' }),
    });

    expect(res.status).toBe(201);
  });
});
