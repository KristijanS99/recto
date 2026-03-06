import { eq } from 'drizzle-orm';
import type { Database } from '../db/connection.js';
import { entries } from '../db/schema.js';
import { createLogger } from '../lib/logger.js';
import type { EmbeddingProvider } from './embedding.js';
import type { LLMProvider } from './llm.js';

export type EnrichCallback = (entryId: string) => void;

const logger = createLogger('enrichment');

export function mergeTags(existing: string[], aiTags: string[]): string[] {
  const merged = new Set(existing.map((t) => t.toLowerCase()));
  for (const tag of aiTags) {
    merged.add(tag.toLowerCase());
  }
  return [...merged].sort();
}

export async function enrichEntry(
  db: Database,
  llmProvider: LLMProvider,
  embeddingProvider: EmbeddingProvider,
  entryId: string,
): Promise<void> {
  const [entry] = await db.select().from(entries).where(eq(entries.id, entryId));
  if (!entry) return;

  logger.info('Enrichment started', { entryId });

  const hasEmbedding = embeddingProvider.dimensions > 0;

  // Run LLM enrichment and embedding in parallel
  const [llmResult, embResult] = await Promise.allSettled([
    llmProvider.enrich(entry.content),
    hasEmbedding ? embeddingProvider.embed(entry.content) : Promise.resolve(null),
  ]);

  // biome-ignore lint/suspicious/noExplicitAny: dynamic update mapping
  const update: Record<string, any> = {};

  // Process LLM result
  if (llmResult.status === 'fulfilled') {
    const value = llmResult.value;
    // NullLLM returns empty title — skip if no meaningful result
    if (value.title || value.tags.length > 0 || value.mood || value.people.length > 0) {
      if (!entry.title && value.title) {
        update.title = value.title;
      }
      if (value.tags.length > 0) {
        update.tags = mergeTags(entry.tags ?? [], value.tags);
      }
      if (value.mood) update.mood = value.mood;
      if (value.people.length > 0) {
        const existingPeople = new Set(entry.people ?? []);
        for (const p of value.people) existingPeople.add(p);
        update.people = [...existingPeople];
      }
    }
  } else {
    logger.error('LLM enrichment failed', { entryId, error: String(llmResult.reason) });
  }

  // Process embedding result
  if (embResult.status === 'fulfilled' && embResult.value) {
    update.embedding = embResult.value;
  } else if (embResult.status === 'rejected') {
    logger.error('Embedding failed', { entryId, error: String(embResult.reason) });
  }

  if (Object.keys(update).length > 0) {
    await db.update(entries).set(update).where(eq(entries.id, entryId));
    logger.info('Enrichment completed', { entryId, fields: Object.keys(update) });
  }
}
