import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../db/schema.js';
import { entries, instructions, prompts } from '../db/schema.js';
import { DEFAULT_PROMPTS } from '../db/seed.js';

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();

  client = postgres(container.getConnectionUri());
  db = drizzle(client, { schema });

  // Enable pgvector extension before running migrations
  await client`CREATE EXTENSION IF NOT EXISTS vector`;

  await migrate(db, {
    migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
  });
}, 60_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
}, 30_000);

describe('database schema', () => {
  it('should apply migrations successfully', async () => {
    const result = await client`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'entries'
    `;
    expect(result).toHaveLength(1);
    expect(result[0]?.table_name).toBe('entries');
  });

  it('should have all expected columns', async () => {
    const result = await client`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'entries'
      ORDER BY ordinal_position
    `;
    const columns = result.map((r) => r.column_name);
    expect(columns).toEqual([
      'id',
      'content',
      'title',
      'created_at',
      'updated_at',
      'tags',
      'mood',
      'people',
      'embedding',
      'media',
      'metadata',
    ]);
  });

  it('should have GIN indexes for tags and people', async () => {
    const result = await client`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'entries'
      AND indexname IN ('entries_tags_idx', 'entries_people_idx')
      ORDER BY indexname
    `;
    expect(result).toHaveLength(2);
    expect(result[0]?.indexdef).toContain('gin');
    expect(result[1]?.indexdef).toContain('gin');
  });

  it('should have FTS GIN index', async () => {
    const result = await client`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'entries' AND indexname = 'entries_fts_idx'
    `;
    expect(result).toHaveLength(1);
    expect(result[0]?.indexdef).toContain('gin');
    expect(result[0]?.indexdef).toContain('to_tsvector');
  });

  it('should have HNSW index for embeddings', async () => {
    const result = await client`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'entries' AND indexname = 'entries_embedding_idx'
    `;
    expect(result).toHaveLength(1);
    expect(result[0]?.indexdef).toContain('hnsw');
    expect(result[0]?.indexdef).toContain('vector_cosine_ops');
  });
});

describe('entry CRUD via Drizzle', () => {
  it('should insert and read an entry', async () => {
    const [inserted] = await db
      .insert(entries)
      .values({
        content: 'Today was a good day.',
        title: 'Good day',
        tags: ['personal', 'positive'],
        mood: 'happy',
        people: ['Alice'],
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted!.id).toBeTruthy();
    expect(inserted!.content).toBe('Today was a good day.');
    expect(inserted!.tags).toEqual(['personal', 'positive']);
    expect(inserted!.mood).toBe('happy');
    expect(inserted!.people).toEqual(['Alice']);
    expect(inserted!.createdAt).toBeInstanceOf(Date);

    // Read it back
    const [found] = await db.select().from(entries).where(eq(entries.id, inserted!.id));
    expect(found).toBeDefined();
    expect(found!.content).toBe('Today was a good day.');
  });

  it('should insert entry with minimal fields', async () => {
    const [inserted] = await db
      .insert(entries)
      .values({ content: 'Just some thoughts.' })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted!.title).toBeNull();
    expect(inserted!.tags).toEqual([]);
    expect(inserted!.mood).toBeNull();
    expect(inserted!.people).toEqual([]);
    expect(inserted!.media).toEqual([]);
    expect(inserted!.metadata).toEqual({});
    expect(inserted!.embedding).toBeNull();
  });

  it('should update an entry', async () => {
    const [inserted] = await db.insert(entries).values({ content: 'Original content' }).returning();

    const [updated] = await db
      .update(entries)
      .set({ content: 'Updated content', mood: 'reflective' })
      .where(eq(entries.id, inserted!.id))
      .returning();

    expect(updated!.content).toBe('Updated content');
    expect(updated!.mood).toBe('reflective');
  });

  it('should delete an entry', async () => {
    const [inserted] = await db.insert(entries).values({ content: 'To be deleted' }).returning();

    await db.delete(entries).where(eq(entries.id, inserted!.id));

    const found = await db.select().from(entries).where(eq(entries.id, inserted!.id));
    expect(found).toHaveLength(0);
  });

  it('should support full-text search', async () => {
    await db.insert(entries).values({ content: 'Exploring the mountains and hiking trails' });
    await db.insert(entries).values({ content: 'Cooking a nice Italian dinner' });

    const result = await db
      .select()
      .from(entries)
      .where(
        sql`to_tsvector('english', coalesce(${entries.title}, '') || ' ' || ${entries.content}) @@ plainto_tsquery('english', 'mountains hiking')`,
      );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.content).toContain('mountains');
  });
});

describe('instructions table', () => {
  beforeEach(async () => {
    await db.delete(instructions);
  });

  it('should create and read instructions', async () => {
    const [inserted] = await db
      .insert(instructions)
      .values({ content: 'Test instructions' })
      .returning();

    expect(inserted!.id).toBeTruthy();
    expect(inserted!.content).toBe('Test instructions');
    expect(inserted!.updatedAt).toBeInstanceOf(Date);
  });

  it('should update instructions', async () => {
    const [inserted] = await db.insert(instructions).values({ content: 'Original' }).returning();

    const [updated] = await db
      .update(instructions)
      .set({ content: 'Updated' })
      .where(eq(instructions.id, inserted!.id))
      .returning();

    expect(updated!.content).toBe('Updated');
  });
});

describe('prompts table', () => {
  beforeEach(async () => {
    await db.delete(prompts);
  });

  it('should create and read a prompt', async () => {
    const [inserted] = await db
      .insert(prompts)
      .values({
        name: 'test-prompt',
        description: 'Test Prompt',
        content: 'Tell me about your day',
        isDefault: false,
      })
      .returning();

    expect(inserted!.id).toBeTruthy();
    expect(inserted!.name).toBe('test-prompt');
    expect(inserted!.isDefault).toBe(false);
  });

  it('should enforce unique name constraint', async () => {
    await db.insert(prompts).values({
      name: 'unique-name',
      description: 'First',
      content: 'First content',
    });

    await expect(
      db.insert(prompts).values({
        name: 'unique-name',
        description: 'Second',
        content: 'Second content',
      }),
    ).rejects.toThrow();
  });

  it('should seed all default prompts', async () => {
    await db.insert(prompts).values(DEFAULT_PROMPTS);
    const all = await db.select().from(prompts);
    expect(all).toHaveLength(6);
    expect(all.every((p) => p.isDefault === true)).toBe(true);
  });
});
