import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import type { Database } from './db/connection.js';
import { createLogger } from './lib/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { entriesRoutes } from './routes/entries.js';
import { instructionsRoutes } from './routes/instructions.js';
import { mediaRoutes } from './routes/media.js';
import { oauthRoutes } from './routes/oauth.js';
import { promptsRoutes } from './routes/prompts.js';
import { reflectRoutes } from './routes/reflect.js';
import { searchRoutes } from './routes/search.js';
import { systemRoutes } from './routes/system.js';
import { entryTagsRoutes, tagsRoutes } from './routes/tags.js';
import { type EmbeddingProvider, NullEmbedding } from './services/embedding.js';
import { enrichEntry } from './services/enrichment.js';
import { type LLMProvider, NullLLM } from './services/llm.js';
import { cleanupExpiredTokens } from './services/oauth.js';

const logger = createLogger('app');

export interface AppDeps {
  embeddingProvider?: EmbeddingProvider | null;
  llmProvider?: LLMProvider | null;
}

export function createApp(db: Database, config: Config, deps?: AppDeps) {
  const embeddingProvider = deps?.embeddingProvider ?? null;
  const llmProvider = deps?.llmProvider ?? null;
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

  // OAuth routes (no auth — public endpoints)
  if (config.RECTO_ISSUER_URL) {
    app.route(
      '/',
      oauthRoutes({
        issuerUrl: config.RECTO_ISSUER_URL,
        db,
        apiKey: config.RECTO_API_KEY,
        accessTokenTtl: config.RECTO_ACCESS_TOKEN_TTL,
        refreshTokenTtl: config.RECTO_REFRESH_TOKEN_TTL,
      }),
    );
  }

  // Auth middleware for all other routes
  app.use('/*', authMiddleware(config.RECTO_API_KEY, db));

  // Build enrichment callback
  const effectiveLLM = llmProvider ?? new NullLLM();
  const effectiveEmbedding = embeddingProvider ?? new NullEmbedding();
  const hasEnrichment = !(effectiveLLM instanceof NullLLM) || effectiveEmbedding.dimensions > 0;

  const onEnrich = hasEnrichment
    ? (entryId: string) => {
        enrichEntry(db, effectiveLLM, effectiveEmbedding, entryId).catch((err) =>
          logger.error('Enrichment pipeline failed', { entryId, error: String(err) }),
        );
      }
    : undefined;

  // Entry routes
  app.route('/entries', entriesRoutes(db, onEnrich));

  // Tag routes
  app.route('/tags', tagsRoutes(db));

  // Search routes
  app.route('/search', searchRoutes(db, embeddingProvider));

  // Reflect routes
  app.route('/reflect', reflectRoutes(db, effectiveLLM));

  // Entry sub-routes (tags, media)
  app.route('/entries', entryTagsRoutes(db));
  app.route('/entries', mediaRoutes(db));

  // Instructions & prompts routes
  app.route('/instructions', instructionsRoutes(db));
  app.route('/prompts', promptsRoutes(db));

  // Schedule expired OAuth token cleanup every hour
  setInterval(
    () => {
      cleanupExpiredTokens(db).catch((err) => {
        console.error('OAuth token cleanup failed:', err);
      });
    },
    60 * 60 * 1000,
  );

  return app;
}
