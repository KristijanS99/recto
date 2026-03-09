import { zValidator } from '@hono/zod-validator';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Database } from '../db/connection.js';
import { entries } from '../db/schema.js';
import { notFound } from '../lib/responses.js';
import { addTagsSchema, removeTagsSchema } from '../types.js';

export function tagsRoutes(db: Database) {
  const app = new Hono();

  // GET /tags — List all unique tags with counts
  app.get('/', async (c) => {
    const result = await db.execute(sql`
      SELECT tag, COUNT(*) as count
      FROM entries, unnest(tags) AS tag
      GROUP BY tag
      ORDER BY count DESC, tag ASC
    `);

    const tags = (result as Record<string, unknown>[]).map((row) => ({
      tag: row.tag as string,
      count: Number(row.count),
    }));

    return c.json({ data: tags });
  });

  return app;
}

export function entryTagsRoutes(db: Database) {
  const app = new Hono();

  // POST /entries/:id/tags — Add tags to entry
  app.post('/:id/tags', zValidator('json', addTagsSchema), async (c) => {
    const id = c.req.param('id');
    const { tags } = c.req.valid('json');

    const [entry] = await db.select().from(entries).where(eq(entries.id, id));
    if (!entry) {
      return notFound(c, 'Entry not found');
    }

    const existingTags = entry.tags ?? [];
    const merged = [...new Set([...existingTags, ...tags])].sort();

    const [updated] = await db
      .update(entries)
      .set({ tags: merged })
      .where(eq(entries.id, id))
      .returning();

    return c.json(updated);
  });

  // DELETE /entries/:id/tags — Remove tags from entry
  app.delete('/:id/tags', zValidator('json', removeTagsSchema), async (c) => {
    const id = c.req.param('id');
    const { tags } = c.req.valid('json');

    const [entry] = await db.select().from(entries).where(eq(entries.id, id));
    if (!entry) {
      return notFound(c, 'Entry not found');
    }

    const existing = entry.tags ?? [];
    const removeSet = new Set(tags);
    const filtered = existing.filter((t) => !removeSet.has(t));

    const [updated] = await db
      .update(entries)
      .set({ tags: filtered })
      .where(eq(entries.id, id))
      .returning();

    return c.json(updated);
  });

  return app;
}
