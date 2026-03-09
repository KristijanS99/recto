import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ERROR_CODE, HTTP_STATUS, SEARCH_DEFAULT_LIMIT } from '../constants.js';
import type { Database } from '../db/connection.js';
import type { EmbeddingProvider } from '../services/embedding.js';
import { search } from '../services/search.js';

const searchQuerySchema = z.object({
  q: z.string().min(1),
  mode: z.enum(['hybrid', 'semantic', 'keyword']).default('hybrid'),
  limit: z.coerce.number().int().min(1).max(100).default(SEARCH_DEFAULT_LIMIT),
  tag: z.string().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export function searchRoutes(db: Database, embeddingProvider: EmbeddingProvider | null) {
  const app = new Hono();

  app.get('/', zValidator('query', searchQuerySchema), async (c) => {
    const { q, mode, limit, tag, from, to } = c.req.valid('query');

    const hasEmbedding = embeddingProvider && embeddingProvider.dimensions > 0;

    // If semantic explicitly requested but no embedding provider, return 400
    if (mode === 'semantic' && !hasEmbedding) {
      return c.json(
        {
          error: {
            code: ERROR_CODE.BAD_REQUEST,
            message: 'Semantic search requires an embedding provider to be configured',
          },
        },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const result = await search(db, embeddingProvider, {
      query: q,
      mode,
      limit,
      tag,
      from,
      to,
    });

    return c.json(result);
  });

  return app;
}
