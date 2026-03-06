import type { MiddlewareHandler } from 'hono';

export function authMiddleware(apiKey: string): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header) {
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } },
        401,
      );
    }

    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token !== apiKey) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }, 401);
    }

    await next();
  };
}
