import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema.js';
import { accessTokens, authorizationCodes, refreshTokens } from '../db/schema.js';
import { cleanupExpiredTokens, hashToken } from '../services/oauth.js';

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
// biome-ignore lint/suspicious/noExplicitAny: test helper
let db: any;

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

describe('cleanupExpiredTokens', () => {
  it('removes expired records and keeps valid ones', async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);

    // Insert expired auth code
    await db.insert(authorizationCodes).values({
      code: hashToken('expired-code'),
      clientId: 'test',
      redirectUri: 'http://localhost/cb',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      expiresAt: past,
    });

    // Insert valid auth code
    await db.insert(authorizationCodes).values({
      code: hashToken('valid-code'),
      clientId: 'test',
      redirectUri: 'http://localhost/cb',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      expiresAt: future,
    });

    // Insert expired access token
    await db.insert(accessTokens).values({
      token: hashToken('expired-access'),
      clientId: 'test',
      scopes: [],
      expiresAt: past,
    });

    // Insert valid access token
    const [validAccess] = await db
      .insert(accessTokens)
      .values({
        token: hashToken('valid-access'),
        clientId: 'test',
        scopes: [],
        expiresAt: future,
      })
      .returning({ id: accessTokens.id });

    // Insert expired refresh token
    await db.insert(refreshTokens).values({
      token: hashToken('expired-refresh'),
      clientId: 'test',
      accessTokenId: validAccess!.id,
      expiresAt: past,
    });

    // Insert valid refresh token
    await db.insert(refreshTokens).values({
      token: hashToken('valid-refresh'),
      clientId: 'test',
      accessTokenId: validAccess!.id,
      expiresAt: future,
    });

    // Run cleanup
    await cleanupExpiredTokens(db);

    // Verify
    const [codeCount] = await db.select({ count: count() }).from(authorizationCodes);
    const [accessCount] = await db.select({ count: count() }).from(accessTokens);
    const [refreshCount] = await db.select({ count: count() }).from(refreshTokens);

    expect(codeCount!.count).toBe(1);
    expect(accessCount!.count).toBe(1);
    expect(refreshCount!.count).toBe(1);
  });
});
