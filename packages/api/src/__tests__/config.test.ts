import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'DATABASE_URL',
  'RECTO_API_KEY',
  'LLM_PROVIDER',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'EMBEDDING_PROVIDER',
  'EMBEDDING_DIMENSIONS',
  'VOYAGE_API_KEY',
  'OLLAMA_URL',
  'OLLAMA_EMBEDDING_MODEL',
  'API_PORT',
] as const;

function setMinimalEnv() {
  process.env.DATABASE_URL = 'http://localhost:5432/recto';
  process.env.RECTO_API_KEY = 'test-key';
}

function cleanEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

async function loadFreshModule() {
  const mod = await import('../config.js');
  return mod;
}

describe('config', () => {
  beforeEach(() => {
    cleanEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    cleanEnv();
  });

  it('loadConfig with minimal valid env returns correct defaults', async () => {
    setMinimalEnv();
    const { loadConfig } = await loadFreshModule();
    const config = loadConfig();

    expect(config.DATABASE_URL).toBe('http://localhost:5432/recto');
    expect(config.RECTO_API_KEY).toBe('test-key');
    expect(config.LLM_PROVIDER).toBe('none');
    expect(config.EMBEDDING_PROVIDER).toBe('none');
    expect(config.API_PORT).toBe(3000);
    expect(config.embeddingDimensions).toBeNull();
    expect(config.OLLAMA_EMBEDDING_MODEL).toBe('nomic-embed-text');
  });

  it('exits on missing DATABASE_URL', async () => {
    process.env.RECTO_API_KEY = 'test-key';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { loadConfig } = await loadFreshModule();
    loadConfig();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits on missing RECTO_API_KEY', async () => {
    process.env.DATABASE_URL = 'http://localhost:5432/recto';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { loadConfig } = await loadFreshModule();
    loadConfig();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('auto-detects openai embedding dimensions (1536)', async () => {
    setMinimalEnv();
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';

    const { loadConfig } = await loadFreshModule();
    const config = loadConfig();

    expect(config.embeddingDimensions).toBe(1536);
  });

  it('auto-detects voyageai embedding dimensions (1024)', async () => {
    setMinimalEnv();
    process.env.EMBEDDING_PROVIDER = 'voyageai';
    process.env.VOYAGE_API_KEY = 'vk-test';

    const { loadConfig } = await loadFreshModule();
    const config = loadConfig();

    expect(config.embeddingDimensions).toBe(1024);
  });

  it('auto-detects ollama embedding dimensions (768)', async () => {
    setMinimalEnv();
    process.env.EMBEDDING_PROVIDER = 'ollama';
    process.env.OLLAMA_URL = 'http://localhost:11434';

    const { loadConfig } = await loadFreshModule();
    const config = loadConfig();

    expect(config.embeddingDimensions).toBe(768);
  });

  it('overrides dimensions with EMBEDDING_DIMENSIONS env', async () => {
    setMinimalEnv();
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.EMBEDDING_DIMENSIONS = '2048';

    const { loadConfig } = await loadFreshModule();
    const config = loadConfig();

    expect(config.embeddingDimensions).toBe(2048);
  });

  it('caches config on second call (same reference)', async () => {
    setMinimalEnv();

    const { loadConfig } = await loadFreshModule();
    const first = loadConfig();
    const second = loadConfig();

    expect(first).toBe(second);
  });

  it('coerces API_PORT from string to number', async () => {
    setMinimalEnv();
    process.env.API_PORT = '8080';

    const { loadConfig } = await loadFreshModule();
    const config = loadConfig();

    expect(config.API_PORT).toBe(8080);
    expect(typeof config.API_PORT).toBe('number');
  });

  it('getConfig throws if loadConfig not called', async () => {
    const { getConfig } = await loadFreshModule();

    expect(() => getConfig()).toThrow('Config not loaded. Call loadConfig() first.');
  });

  it('getConfig returns config after loadConfig', async () => {
    setMinimalEnv();

    const { loadConfig, getConfig } = await loadFreshModule();
    const loaded = loadConfig();
    const got = getConfig();

    expect(got).toBe(loaded);
  });
});
