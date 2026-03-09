import { z } from 'zod';
import { EMBEDDING_DIMENSIONS } from './constants.js';

const embeddingProviderSchema = z.enum(['openai', 'voyageai', 'ollama', 'none']).default('none');
const llmProviderSchema = z.enum(['anthropic', 'openai', 'none']).default('none');

const envSchema = z
  .object({
    // Database
    DATABASE_URL: z.string().url(),

    // Auth
    RECTO_API_KEY: z.string().min(1),

    // OAuth
    RECTO_ISSUER_URL: z.string().url().optional(),
    RECTO_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(3600),
    RECTO_REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(7776000),

    // LLM
    LLM_PROVIDER: llmProviderSchema,
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),

    // Embeddings
    EMBEDDING_PROVIDER: embeddingProviderSchema,
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().optional(),
    VOYAGE_API_KEY: z.string().optional(),
    OLLAMA_URL: z.string().url().optional(),
    OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),

    // Server
    API_PORT: z.coerce.number().int().positive().default(3000),
  })
  .transform((env) => {
    const embeddingProvider = env.EMBEDDING_PROVIDER;
    const embeddingDimensions =
      env.EMBEDDING_DIMENSIONS ??
      (embeddingProvider !== 'none'
        ? EMBEDDING_DIMENSIONS[embeddingProvider as keyof typeof EMBEDDING_DIMENSIONS]
        : undefined);

    return {
      ...env,
      embeddingDimensions: embeddingDimensions ?? null,
    };
  });

export type Config = z.output<typeof envSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  _config = result.data;
  return _config;
}

export function getConfig(): Config {
  if (!_config) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return _config;
}
