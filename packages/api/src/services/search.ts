import { sql } from 'drizzle-orm';
import { RRF_K } from '../constants.js';
import type { Database } from '../db/connection.js';
import { type Entry, entries } from '../db/schema.js';
import type { EmbeddingProvider } from './embedding.js';

export interface SearchResult {
  entry: Entry;
  score: number;
  highlights?: string[];
}

export interface SearchOptions {
  query: string;
  mode: 'keyword' | 'semantic' | 'hybrid';
  limit: number;
  tag?: string;
  from?: string;
  to?: string;
}

interface RankedItem {
  id: string;
  score: number;
  highlights?: string[];
}

// ---------------------------------------------------------------------------
// RRF (Reciprocal Rank Fusion)
// ---------------------------------------------------------------------------
export function rrf(lists: RankedItem[][], k = RRF_K): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      if (!item) continue;
      const id = item.id;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    }
  }
  return scores;
}

// ---------------------------------------------------------------------------
// Build WHERE clause fragments for filters
// ---------------------------------------------------------------------------
function buildFilterClause(opts: SearchOptions): ReturnType<typeof sql> {
  const conditions: ReturnType<typeof sql>[] = [];

  if (opts.tag) {
    conditions.push(sql`${opts.tag} = ANY(${entries.tags})`);
  }
  if (opts.from) {
    conditions.push(sql`${entries.createdAt} > ${opts.from}`);
  }
  if (opts.to) {
    conditions.push(sql`${entries.createdAt} < ${opts.to}`);
  }

  if (conditions.length === 0) return sql`TRUE`;
  return sql.join(conditions, sql` AND `);
}

// ---------------------------------------------------------------------------
// BM25 keyword search
// ---------------------------------------------------------------------------
export async function keywordSearch(db: Database, opts: SearchOptions): Promise<RankedItem[]> {
  const filterClause = buildFilterClause(opts);

  const results = await db.execute(sql`
    SELECT
      id,
      ts_rank(
        to_tsvector('english', coalesce(title, '') || ' ' || content),
        websearch_to_tsquery('english', ${opts.query})
      ) AS score,
      ts_headline(
        'english',
        coalesce(title, '') || ' ' || content,
        websearch_to_tsquery('english', ${opts.query}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
      ) AS headline
    FROM entries
    WHERE to_tsvector('english', coalesce(title, '') || ' ' || content)
          @@ websearch_to_tsquery('english', ${opts.query})
      AND ${filterClause}
    ORDER BY score DESC
    LIMIT ${opts.limit}
  `);

  return (results as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    score: Number(row.score),
    highlights: row.headline ? [row.headline as string] : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Semantic (vector) search
// ---------------------------------------------------------------------------
export async function semanticSearch(
  db: Database,
  embeddingProvider: EmbeddingProvider,
  opts: SearchOptions,
): Promise<RankedItem[]> {
  const queryEmbedding = await embeddingProvider.embed(opts.query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const filterClause = buildFilterClause(opts);

  const results = await db.execute(sql`
    SELECT
      id,
      1 - (embedding <=> ${vectorStr}::vector) AS score
    FROM entries
    WHERE embedding IS NOT NULL
      AND ${filterClause}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${opts.limit}
  `);

  return (results as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    score: Number(row.score),
  }));
}

// ---------------------------------------------------------------------------
// Main search function
// ---------------------------------------------------------------------------
export async function search(
  db: Database,
  embeddingProvider: EmbeddingProvider | null,
  opts: SearchOptions,
): Promise<{ results: SearchResult[]; mode_used: string; total: number }> {
  const hasEmbedding = embeddingProvider && embeddingProvider.dimensions > 0;

  // Determine effective mode
  let effectiveMode = opts.mode;
  if (effectiveMode === 'hybrid' && !hasEmbedding) {
    effectiveMode = 'keyword';
  }

  let rankedItems: RankedItem[];

  if (effectiveMode === 'keyword') {
    rankedItems = await keywordSearch(db, opts);
  } else if (effectiveMode === 'semantic') {
    if (!hasEmbedding) {
      return { results: [], mode_used: 'semantic', total: 0 };
    }
    rankedItems = await semanticSearch(db, embeddingProvider as EmbeddingProvider, opts);
  } else {
    // hybrid: run both in parallel, merge with RRF
    const [kwResults, semResults] = await Promise.all([
      keywordSearch(db, opts),
      semanticSearch(db, embeddingProvider as EmbeddingProvider, opts),
    ]);

    const rrfScores = rrf([kwResults, semResults]);

    // Merge and sort by RRF score
    const allItems = new Map<string, RankedItem>();
    for (const item of [...kwResults, ...semResults]) {
      if (!allItems.has(item.id)) {
        allItems.set(item.id, { ...item, score: rrfScores.get(item.id) ?? 0 });
      } else {
        const existing = allItems.get(item.id);
        if (existing) {
          if (item.highlights && !existing.highlights) {
            existing.highlights = item.highlights;
          }
          existing.score = rrfScores.get(item.id) ?? existing.score;
        }
      }
    }

    rankedItems = [...allItems.values()].sort((a, b) => b.score - a.score).slice(0, opts.limit);
  }

  // Fetch full entries for the ranked IDs
  if (rankedItems.length === 0) {
    return { results: [], mode_used: effectiveMode, total: 0 };
  }

  const ids = rankedItems.map((r) => r.id);
  const idList = sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const entryRows = await db.execute(sql`SELECT * FROM entries WHERE id IN (${idList})`);
  const entryMap = new Map<string, Entry>();
  for (const row of entryRows as unknown as Entry[]) {
    entryMap.set(row.id, row);
  }

  const results: SearchResult[] = rankedItems
    .filter((r) => entryMap.has(r.id))
    .map((r) => ({
      entry: entryMap.get(r.id) as Entry,
      score: r.score,
      highlights: r.highlights,
    }));

  return { results, mode_used: effectiveMode, total: results.length };
}
