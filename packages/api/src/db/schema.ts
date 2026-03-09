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

// ---------------------------------------------------------------------------
// OAuth tables
// ---------------------------------------------------------------------------

export const oauthClients = pgTable('oauth_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'),
  clientName: text('client_name').notNull(),
  redirectUris: text('redirect_uris').array().notNull(),
  grantTypes: text('grant_types').array().notNull().default(['authorization_code']),
  responseTypes: text('response_types').array().notNull().default(['code']),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull().default('none'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;

export const authorizationCodes = pgTable('authorization_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull().default('S256'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AuthorizationCode = typeof authorizationCodes.$inferSelect;

export const accessTokens = pgTable('access_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  clientId: text('client_id').notNull(),
  scopes: text('scopes').array().notNull().default([]),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AccessToken = typeof accessTokens.$inferSelect;

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  clientId: text('client_id').notNull(),
  accessTokenId: uuid('access_token_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;

export interface MediaItem {
  type: 'image' | 'audio' | 'video' | 'link';
  url: string;
  caption?: string;
}
