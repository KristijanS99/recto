import { and, eq, gt } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { ERROR_CODE, HTTP_STATUS } from '../constants.js';
import type { Database } from '../db/connection.js';
import { accessTokens } from '../db/schema.js';
import { safeEqual } from '../lib/crypto.js';
import { hashToken } from '../services/oauth.js';

export function authMiddleware(apiKey: string, db?: Database): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header) {
      return c.json(
        { error: { code: ERROR_CODE.UNAUTHORIZED, message: 'Missing Authorization header' } },
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return c.json(
        { error: { code: ERROR_CODE.UNAUTHORIZED, message: 'Invalid API key' } },
        HTTP_STATUS.UNAUTHORIZED,
      );
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

    return c.json(
      { error: { code: ERROR_CODE.UNAUTHORIZED, message: 'Invalid API key' } },
      HTTP_STATUS.UNAUTHORIZED,
    );
  };
}
