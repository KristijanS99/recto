import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';

export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    tags: text('tags').array().default([]),
    mood: text('mood'),
    people: text('people').array().default([]),
    embedding: vector('embedding', { dimensions: 1536 }),
    media: jsonb('media').$type<MediaItem[]>().default([]),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    index('entries_created_at_idx').on(table.createdAt.desc()),
    index('entries_tags_idx').using('gin', table.tags),
    index('entries_people_idx').using('gin', table.people),
    index('entries_fts_idx').using(
      'gin',
      sql`to_tsvector('english', coalesce(${table.title}, '') || ' ' || ${table.content})`,
    ),
    index('entries_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

export const instructions = pgTable('instructions', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Instruction = typeof instructions.$inferSelect;

export const prompts = pgTable('prompts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  content: text('content').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;

export interface MediaItem {
  type: 'image' | 'audio' | 'video' | 'link';
  url: string;
  caption?: string;
}
