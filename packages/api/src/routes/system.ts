import { Hono } from 'hono';
import type { Config } from '../config.js';

const startTime = Date.now();

export function systemRoutes(config: Config) {
  const app = new Hono();

  // GET /health — Health check (no auth required)
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      version: '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });

  // GET /config — Active provider config (no secrets)
  app.get('/config', (c) => {
    return c.json({
      llm_provider: config.LLM_PROVIDER,
      embedding_provider: config.EMBEDDING_PROVIDER,
      embedding_dimensions: config.embeddingDimensions,
    });
  });

  return app;
}
