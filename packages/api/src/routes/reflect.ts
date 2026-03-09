import { zValidator } from '@hono/zod-validator';
import { and, desc, gt, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  ERROR_CODE,
  HTTP_STATUS,
  MAX_CONTEXT_CHARS,
  MAX_ENTRY_WORDS,
  REFLECT_DEFAULT_LIMIT,
} from '../constants.js';
import type { Database } from '../db/connection.js';
import { entries } from '../db/schema.js';
import type { LLMProvider } from '../services/llm.js';
import { NullLLM } from '../services/llm.js';

const reflectSchema = z.object({
  query: z.string().min(1),
  from_date: z.iso.datetime().optional(),
  to_date: z.iso.datetime().optional(),
  limit: z.number().int().min(1).max(50).default(REFLECT_DEFAULT_LIMIT),
});

function truncateEntry(content: string): string {
  const words = content.split(/\s+/);
  if (words.length <= MAX_ENTRY_WORDS) return content;
  return `${words.slice(0, MAX_ENTRY_WORDS).join(' ')}…`;
}

function buildContext(
  entriesData: Array<{ content: string; title: string | null; createdAt: Date; id: string }>,
): { context: string; usedIds: string[] } {
  const usedIds: string[] = [];
  const parts: string[] = [];
  let charCount = 0;

  for (const entry of entriesData) {
    const truncated = truncateEntry(entry.content);
    const dateStr = entry.createdAt.toISOString().split('T')[0];
    const titleStr = entry.title ? ` — ${entry.title}` : '';
    const block = `[${dateStr}${titleStr}]\n${truncated}`;

    if (parts.length > 0 && charCount + block.length > MAX_CONTEXT_CHARS) break;

    parts.push(block);
    usedIds.push(entry.id);
    charCount += block.length;
  }

  return { context: parts.join('\n\n---\n\n'), usedIds };
}

const REFLECTION_PROMPT = `You are a thoughtful journaling assistant. The user wants to reflect on their journal entries.

Here are their journal entries for the requested period:

---
{context}
---

User's question: "{query}"

Provide a thoughtful, empathetic reflection that:
- Identifies patterns and themes across entries
- Highlights changes over time if apparent
- Is supportive but honest
- References specific entries when relevant
- Keeps the response concise (2-3 paragraphs)`;

export function reflectRoutes(db: Database, llmProvider: LLMProvider) {
  const app = new Hono();

  app.post('/', zValidator('json', reflectSchema), async (c) => {
    // Check if LLM is available
    if (llmProvider instanceof NullLLM) {
      return c.json(
        {
          error: {
            code: ERROR_CODE.SERVICE_UNAVAILABLE,
            message: 'LLM provider not configured. Set LLM_PROVIDER to use reflections.',
          },
        },
        HTTP_STATUS.SERVICE_UNAVAILABLE,
      );
    }

    const { query, from_date, to_date, limit } = c.req.valid('json');

    // Build conditions for entry retrieval
    const conditions = [];

    // Use full-text search if possible to find relevant entries
    conditions.push(
      sql`to_tsvector('english', coalesce(${entries.title}, '') || ' ' || ${entries.content})
          @@ websearch_to_tsquery('english', ${query})`,
    );

    if (from_date) {
      conditions.push(gt(entries.createdAt, new Date(from_date)));
    }
    if (to_date) {
      conditions.push(lt(entries.createdAt, new Date(to_date)));
    }

    // Try search-based retrieval first
    let results = await db
      .select()
      .from(entries)
      .where(and(...conditions))
      .orderBy(desc(entries.createdAt))
      .limit(limit);

    // If no search results, fall back to date-filtered entries
    if (results.length === 0) {
      const fallbackConditions = [];
      if (from_date) fallbackConditions.push(gt(entries.createdAt, new Date(from_date)));
      if (to_date) fallbackConditions.push(lt(entries.createdAt, new Date(to_date)));

      const where = fallbackConditions.length > 0 ? and(...fallbackConditions) : undefined;
      results = await db
        .select()
        .from(entries)
        .where(where)
        .orderBy(desc(entries.createdAt))
        .limit(limit);
    }

    if (results.length === 0) {
      return c.json({
        reflection: 'No entries found for this period.',
        entries_used: [],
        period: { from: from_date ?? null, to: to_date ?? null },
      });
    }

    // Build context from entries
    const { context, usedIds } = buildContext(results);

    // Generate reflection
    const prompt = REFLECTION_PROMPT.replace('{context}', context).replace('{query}', query);
    const reflection = await llmProvider.generate(prompt);

    // Build entries_used summary
    const entriesUsed = results
      .filter((e) => usedIds.includes(e.id))
      .map((e) => ({
        id: e.id,
        title: e.title,
        created_at: e.createdAt.toISOString(),
      }));

    // Determine actual date range
    const dates = results.map((e) => e.createdAt);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    return c.json({
      reflection,
      entries_used: entriesUsed,
      period: {
        from: from_date ?? minDate.toISOString(),
        to: to_date ?? maxDate.toISOString(),
      },
    });
  });

  return app;
}

// Exported for testing
export { buildContext, truncateEntry };
