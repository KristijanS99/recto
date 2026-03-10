import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { OAUTH_CLEANUP_INTERVAL_MS } from './constants.js';
import { createDb } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { createLogger } from './lib/logger.js';
import { createEmbeddingProvider } from './services/embedding.js';
import { createLLMProvider } from './services/llm.js';
import { cleanupExpiredTokens } from './services/oauth.js';

const logger = createLogger('server');

async function main() {
  const config = loadConfig();
  const { db } = createDb(config.DATABASE_URL);

  await runMigrations(db);

  const embeddingProvider = createEmbeddingProvider(config);
  const llmProvider = createLLMProvider(config);
  const app = createApp(db, config, { embeddingProvider, llmProvider });

  // Schedule expired OAuth token cleanup every hour
  setInterval(() => {
    cleanupExpiredTokens(db).catch((err) => {
      logger.error('OAuth token cleanup failed', { error: String(err) });
    });
  }, OAUTH_CLEANUP_INTERVAL_MS);

  serve({ fetch: app.fetch, port: config.API_PORT }, () => {
    logger.info('Server started', { port: config.API_PORT });
  });
}

main().catch((err) => {
  logger.error('Failed to start', { error: String(err) });
  process.exit(1);
});
