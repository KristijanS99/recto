import { timingSafeEqual } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { Database } from '../db/connection.js';
import { accessTokens } from '../db/schema.js';
import { hashToken } from '../services/oauth.js';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function authMiddleware(apiKey: string, db?: Database): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header) {
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } },
        401,
      );
    }

    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }, 401);
    }

    // Fast path: static API key (timing-safe comparison)
    if (safeEqual(token, apiKey)) {
      await next();
      return;
    }

    // Slow path: OAuth access token lookup
    if (db) {
      const [valid] = await db
        .select({ id: accessTokens.id })
        .from(accessTokens)
        .where(
          and(eq(accessTokens.token, hashToken(token)), gt(accessTokens.expiresAt, new Date())),
        )
        .limit(1);

      if (valid) {
        await next();
        return;
      }
    }

    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }, 401);
  };
}
