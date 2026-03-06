import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import * as schema from '../db/schema.js';
import { entries } from '../db/schema.js';
import { buildContext, truncateEntry } from '../routes/reflect.js';
import type { EnrichmentResult, LLMProvider } from '../services/llm.js';

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
// biome-ignore lint/suspicious/noExplicitAny: test helper
let db: any;

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
}, 60_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
}, 30_000);

beforeEach(async () => {
  await db.delete(entries);
});

function jsonReq(
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  app: any,
  path: string,
  body: unknown,
) {
  return app.request(path, {
    method: 'POST',
    headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function json(res: Response): Promise<any> {
  return res.json();
}

// ============================================================================
// Unit tests
// ============================================================================
describe('truncateEntry', () => {
  it('returns short content unchanged', () => {
    expect(truncateEntry('Hello world')).toBe('Hello world');
  });

  it('truncates content over 500 words', () => {
    const longContent = Array(600).fill('word').join(' ');
    const result = truncateEntry(longContent);
    const wordCount = result.replace('…', '').trim().split(/\s+/).length;
    expect(wordCount).toBe(500);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('buildContext', () => {
  it('builds context from entries', () => {
    const testEntries = [
      { content: 'First entry', title: 'Day One', createdAt: new Date('2024-01-15'), id: '1' },
      { content: 'Second entry', title: null, createdAt: new Date('2024-01-16'), id: '2' },
    ];

    const { context, usedIds } = buildContext(testEntries);
    expect(context).toContain('2024-01-15');
    expect(context).toContain('Day One');
    expect(context).toContain('First entry');
    expect(context).toContain('Second entry');
    expect(usedIds).toEqual(['1', '2']);
  });

  it('respects character limit', () => {
    const bigEntry = {
      content: 'x'.repeat(20000),
      title: null,
      createdAt: new Date(),
      id: '1',
    };
    const smallEntry = {
      content: 'Should not appear',
      title: null,
      createdAt: new Date(),
      id: '2',
    };

    const { usedIds } = buildContext([bigEntry, smallEntry]);
    // Only the first entry fits
    expect(usedIds).toEqual(['1']);
  });
});

// ============================================================================
// API tests
// ============================================================================
describe('POST /reflect', () => {
  it('returns 503 when no LLM provider configured', async () => {
    const app = createApp(db, testConfig);

    const res = await jsonReq(app, '/reflect', { query: 'How am I doing?' });
    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns reflection with mock LLM', async () => {
    const mockLLM: LLMProvider = {
      async enrich(): Promise<EnrichmentResult> {
        return { title: '', tags: [], mood: null, people: [] };
      },
      async generate(): Promise<string> {
        return 'You seem to be doing great! Your entries show a positive trend.';
      },
    };

    const app = createApp(db, testConfig, { llmProvider: mockLLM });

    // Create some entries
    await jsonReq(app, '/entries', { content: 'Had a great day at work today' });
    await jsonReq(app, '/entries', { content: 'Feeling productive and happy' });

    const res = await jsonReq(app, '/reflect', { query: 'How am I doing?' });
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.reflection).toContain('positive trend');
    expect(body.entries_used.length).toBeGreaterThanOrEqual(1);
    expect(body.period.from).toBeTruthy();
    expect(body.period.to).toBeTruthy();
  });

  it('returns message when no entries found', async () => {
    const mockLLM: LLMProvider = {
      async enrich(): Promise<EnrichmentResult> {
        return { title: '', tags: [], mood: null, people: [] };
      },
      async generate(): Promise<string> {
        return 'Some reflection';
      },
    };

    const app = createApp(db, testConfig, { llmProvider: mockLLM });

    const res = await jsonReq(app, '/reflect', {
      query: 'xyznonexistent',
      from_date: '2020-01-01T00:00:00Z',
      to_date: '2020-01-02T00:00:00Z',
    });
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.reflection).toBe('No entries found for this period.');
    expect(body.entries_used).toHaveLength(0);
  });

  it('respects date filters', async () => {
    const mockLLM: LLMProvider = {
      async enrich(): Promise<EnrichmentResult> {
        return { title: '', tags: [], mood: null, people: [] };
      },
      async generate(prompt: string): Promise<string> {
        return `Reflected on: ${prompt.substring(0, 50)}`;
      },
    };

    const app = createApp(db, testConfig, { llmProvider: mockLLM });

    // Create entries
    await jsonReq(app, '/entries', { content: 'Recent work update and progress' });

    const future = new Date('2099-01-01T00:00:00Z').toISOString();
    const res = await jsonReq(app, '/reflect', {
      query: 'work',
      to_date: future,
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.entries_used.length).toBeGreaterThanOrEqual(1);
  });

  it('requires query field', async () => {
    const mockLLM: LLMProvider = {
      async enrich(): Promise<EnrichmentResult> {
        return { title: '', tags: [], mood: null, people: [] };
      },
      async generate(): Promise<string> {
        return '';
      },
    };

    const app = createApp(db, testConfig, { llmProvider: mockLLM });

    const res = await jsonReq(app, '/reflect', {});
    expect(res.status).toBe(400);
  });
});
