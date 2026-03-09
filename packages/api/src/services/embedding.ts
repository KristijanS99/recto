import type { Config } from '../config.js';
import { EMBEDDING_DIMENSIONS } from '../constants.js';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}

// ---------------------------------------------------------------------------
// OpenAI — text-embedding-3-small (1536d)
// ---------------------------------------------------------------------------
export class OpenAIEmbedding implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIMENSIONS.openai;

  constructor(private apiKey: string) {}

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0] ?? [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI embedding failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

// ---------------------------------------------------------------------------
// VoyageAI — voyage-3.5-lite (1024d)
// ---------------------------------------------------------------------------
export class VoyageAIEmbedding implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIMENSIONS.voyageai;

  constructor(private apiKey: string) {}

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0] ?? [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'voyage-3.5-lite', input: texts }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`VoyageAI embedding failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

// ---------------------------------------------------------------------------
// Ollama — configurable model (default nomic-embed-text, 768d)
// ---------------------------------------------------------------------------
export class OllamaEmbedding implements EmbeddingProvider {
  readonly dimensions: number;

  constructor(
    private baseUrl: string,
    private model: string,
    dimensions: number,
  ) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: text }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama embedding failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as { embeddings: number[][] };
    return json.embeddings[0] ?? [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results = await Promise.all(texts.map((t) => this.embed(t)));
    return results;
  }
}

// ---------------------------------------------------------------------------
// Null provider — used when embedding is disabled
// ---------------------------------------------------------------------------
export class NullEmbedding implements EmbeddingProvider {
  readonly dimensions = 0;

  async embed(): Promise<number[]> {
    return [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createEmbeddingProvider(config: Config): EmbeddingProvider {
  switch (config.EMBEDDING_PROVIDER) {
    case 'openai':
      if (!config.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required for openai embedding');
      return new OpenAIEmbedding(config.OPENAI_API_KEY);
    case 'voyageai':
      if (!config.VOYAGE_API_KEY) throw new Error('VOYAGE_API_KEY required for voyageai embedding');
      return new VoyageAIEmbedding(config.VOYAGE_API_KEY);
    case 'ollama':
      if (!config.OLLAMA_URL) throw new Error('OLLAMA_URL required for ollama embedding');
      return new OllamaEmbedding(
        config.OLLAMA_URL,
        config.OLLAMA_EMBEDDING_MODEL,
        config.embeddingDimensions ?? EMBEDDING_DIMENSIONS.ollama,
      );
    case 'none':
      return new NullEmbedding();
  }
}
