import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import type { Database } from './db/connection.js';
import { authMiddleware } from './middleware/auth.js';
import { entriesRoutes } from './routes/entries.js';
import { mediaRoutes } from './routes/media.js';
import { searchRoutes } from './routes/search.js';
import { systemRoutes } from './routes/system.js';
import { entryTagsRoutes, tagsRoutes } from './routes/tags.js';
import type { EmbeddingProvider } from './services/embedding.js';

export function createApp(
  db: Database,
  config: Config,
  embeddingProvider?: EmbeddingProvider | null,
) {
  const app = new Hono();

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: { code: 'HTTP_ERROR', message: err.message } }, err.status);
    }

    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: err.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        },
        400,
      );
    }

    console.error('Unhandled error:', err);
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
  });

  // System routes (no auth)
  const system = systemRoutes(config);
  app.route('/', system);

  // Auth middleware for all other routes
  app.use('/*', authMiddleware(config.RECTO_API_KEY));

  // Entry routes
  app.route('/entries', entriesRoutes(db));

  // Tag routes
  app.route('/tags', tagsRoutes(db));

  // Search routes
  app.route('/search', searchRoutes(db, embeddingProvider ?? null));

  // Entry sub-routes (tags, media)
  app.route('/entries', entryTagsRoutes(db));
  app.route('/entries', mediaRoutes(db));

  return app;
}
