import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { createEmbeddingProvider } from './services/embedding.js';
import { createLLMProvider } from './services/llm.js';
import { cleanupExpiredTokens } from './services/oauth.js';

async function main() {
  const config = loadConfig();
  const { db } = createDb(config.DATABASE_URL);

  await runMigrations(db);

  const embeddingProvider = createEmbeddingProvider(config);
  const llmProvider = createLLMProvider(config);
  const app = createApp(db, config, { embeddingProvider, llmProvider });

  // Schedule expired OAuth token cleanup every hour
  setInterval(
    () => {
      cleanupExpiredTokens(db).catch((err) => {
        console.error('OAuth token cleanup failed:', err);
      });
    },
    60 * 60 * 1000,
  );

  serve({ fetch: app.fetch, port: config.API_PORT }, () => {
    console.log(`@recto/api listening on port ${config.API_PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
