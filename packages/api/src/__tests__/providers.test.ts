import { describe, expect, it } from 'vitest';
import type { Config } from '../config.js';
import {
  createEmbeddingProvider,
  NullEmbedding,
  OllamaEmbedding,
  OpenAIEmbedding,
  VoyageAIEmbedding,
} from '../services/embedding.js';
import { AnthropicLLM, createLLMProvider, NullLLM, OpenAILLM } from '../services/llm.js';

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    DATABASE_URL: 'postgresql://x',
    RECTO_API_KEY: 'key',
    LLM_PROVIDER: 'none',
    ANTHROPIC_API_KEY: undefined,
    OPENAI_API_KEY: undefined,
    EMBEDDING_PROVIDER: 'none',
    EMBEDDING_DIMENSIONS: undefined,
    VOYAGE_API_KEY: undefined,
    OLLAMA_URL: undefined,
    OLLAMA_EMBEDDING_MODEL: 'nomic-embed-text',
    API_PORT: 3000,
    embeddingDimensions: null,
    ...overrides,
  } as Config;
}

// ---------------------------------------------------------------------------
// createEmbeddingProvider
// ---------------------------------------------------------------------------
describe('createEmbeddingProvider', () => {
  it('returns NullEmbedding when provider is none with dimensions=0', () => {
    const provider = createEmbeddingProvider(makeConfig({ EMBEDDING_PROVIDER: 'none' }));
    expect(provider).toBeInstanceOf(NullEmbedding);
    expect(provider.dimensions).toBe(0);
  });

  it('returns OpenAIEmbedding when provider is openai with key, dimensions=1536', () => {
    const provider = createEmbeddingProvider(
      makeConfig({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' }),
    );
    expect(provider).toBeInstanceOf(OpenAIEmbedding);
    expect(provider.dimensions).toBe(1536);
  });

  it('throws when provider is openai but no API key', () => {
    expect(() =>
      createEmbeddingProvider(
        makeConfig({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: undefined }),
      ),
    ).toThrow('OPENAI_API_KEY required for openai embedding');
  });

  it('returns VoyageAIEmbedding when provider is voyageai with key, dimensions=1024', () => {
    const provider = createEmbeddingProvider(
      makeConfig({ EMBEDDING_PROVIDER: 'voyageai', VOYAGE_API_KEY: 'voy-test' }),
    );
    expect(provider).toBeInstanceOf(VoyageAIEmbedding);
    expect(provider.dimensions).toBe(1024);
  });

  it('throws when provider is voyageai but no API key', () => {
    expect(() =>
      createEmbeddingProvider(
        makeConfig({ EMBEDDING_PROVIDER: 'voyageai', VOYAGE_API_KEY: undefined }),
      ),
    ).toThrow('VOYAGE_API_KEY required for voyageai embedding');
  });

  it('returns OllamaEmbedding when provider is ollama with URL, dimensions=768', () => {
    const provider = createEmbeddingProvider(
      makeConfig({
        EMBEDDING_PROVIDER: 'ollama',
        OLLAMA_URL: 'http://localhost:11434',
        embeddingDimensions: 768,
      }),
    );
    expect(provider).toBeInstanceOf(OllamaEmbedding);
    expect(provider.dimensions).toBe(768);
  });

  it('throws when provider is ollama but no URL', () => {
    expect(() =>
      createEmbeddingProvider(makeConfig({ EMBEDDING_PROVIDER: 'ollama', OLLAMA_URL: undefined })),
    ).toThrow('OLLAMA_URL required for ollama embedding');
  });
});

// ---------------------------------------------------------------------------
// NullEmbedding
// ---------------------------------------------------------------------------
describe('NullEmbedding', () => {
  const provider = new NullEmbedding();

  it('embed returns empty array', async () => {
    const result = await provider.embed('hello');
    expect(result).toEqual([]);
  });

  it('embedBatch returns array of empty arrays matching input length', async () => {
    const result = await provider.embedBatch(['a', 'b', 'c']);
    expect(result).toEqual([[], [], []]);
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// createLLMProvider
// ---------------------------------------------------------------------------
describe('createLLMProvider', () => {
  it('returns NullLLM when provider is none', () => {
    const provider = createLLMProvider(makeConfig({ LLM_PROVIDER: 'none' }));
    expect(provider).toBeInstanceOf(NullLLM);
  });

  it('returns AnthropicLLM when provider is anthropic with key', () => {
    const provider = createLLMProvider(
      makeConfig({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'ant-test' }),
    );
    expect(provider).toBeInstanceOf(AnthropicLLM);
  });

  it('throws when provider is anthropic but no API key', () => {
    expect(() =>
      createLLMProvider(makeConfig({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: undefined })),
    ).toThrow('ANTHROPIC_API_KEY required for anthropic LLM');
  });

  it('returns OpenAILLM when provider is openai with key', () => {
    const provider = createLLMProvider(
      makeConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' }),
    );
    expect(provider).toBeInstanceOf(OpenAILLM);
  });

  it('throws when provider is openai but no API key', () => {
    expect(() =>
      createLLMProvider(makeConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: undefined })),
    ).toThrow('OPENAI_API_KEY required for openai LLM');
  });
});

// ---------------------------------------------------------------------------
// NullLLM
// ---------------------------------------------------------------------------
describe('NullLLM', () => {
  const provider = new NullLLM();

  it('enrich returns empty enrichment result', async () => {
    const result = await provider.enrich('some content');
    expect(result).toEqual({ title: '', tags: [], mood: null, people: [] });
  });

  it('generate returns empty string', async () => {
    const result = await provider.generate('some prompt');
    expect(result).toBe('');
  });
});
