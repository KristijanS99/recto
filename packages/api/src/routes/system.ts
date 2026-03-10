import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import type { Config } from '../config.js';

const startTime = Date.now();

function findPackageVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === '@recto/api') return pkg.version ?? '0.0.0';
    }
    dir = dirname(dir);
  }
  return '0.0.0';
}

const pkgVersion = findPackageVersion();

export function systemRoutes(config: Config) {
  const app = new Hono();

  // GET /health — Health check (no auth required)
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      version: pkgVersion,
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
