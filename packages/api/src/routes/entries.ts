import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gt, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Database } from '../db/connection.js';
import { entries } from '../db/schema.js';
import {
  createEntrySchema,
  decodeCursor,
  encodeCursor,
  entryFiltersSchema,
  updateEntrySchema,
} from '../types.js';

export function entriesRoutes(db: Database) {
  const app = new Hono();

  // POST /entries — Create entry
  app.post('/', zValidator('json', createEntrySchema), async (c) => {
    const body = c.req.valid('json');
    const [entry] = await db
      .insert(entries)
      .values({
        content: body.content,
        title: body.title,
        tags: body.tags ?? [],
        mood: body.mood,
        people: body.people ?? [],
        metadata: body.metadata ?? {},
      })
      .returning();

    return c.json(entry, 201);
  });

  // GET /entries — List entries with filters and cursor pagination
  app.get('/', zValidator('query', entryFiltersSchema), async (c) => {
    const { limit, cursor, tag, from, to, people } = c.req.valid('query');

    const conditions = [];

    if (cursor) {
      const parsed = decodeCursor(cursor);
      if (!parsed) {
        return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid cursor' } }, 400);
      }
      // Keyset pagination: (created_at, id) < (cursor_created_at, cursor_id)
      conditions.push(
        sql`(${entries.createdAt}, ${entries.id}) < (${parsed.createdAt.toISOString()}, ${parsed.id})`,
      );
    }

    if (tag) {
      conditions.push(sql`${tag} = ANY(${entries.tags})`);
    }

    if (from) {
      conditions.push(gt(entries.createdAt, new Date(from)));
    }

    if (to) {
      conditions.push(lt(entries.createdAt, new Date(to)));
    }

    if (people) {
      conditions.push(sql`${people} = ANY(${entries.people})`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(entries)
      .where(where)
      .orderBy(desc(entries.createdAt), desc(entries.id))
      .limit(limit + 1); // fetch one extra to determine if there's a next page

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    const lastItem = data[data.length - 1];
    const nextCursor =
      hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : undefined;

    return c.json({
      data,
      next_cursor: nextCursor ?? null,
      has_more: hasMore,
    });
  });

  // GET /entries/:id — Get single entry
  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const [entry] = await db.select().from(entries).where(eq(entries.id, id));

    if (!entry) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Entry not found' } }, 404);
    }

    return c.json(entry);
  });

  // PATCH /entries/:id — Update entry
  app.patch('/:id', zValidator('json', updateEntrySchema), async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const [updated] = await db.update(entries).set(body).where(eq(entries.id, id)).returning();

    if (!updated) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Entry not found' } }, 404);
    }

    return c.json(updated);
  });

  // DELETE /entries/:id — Delete entry
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const [deleted] = await db.delete(entries).where(eq(entries.id, id)).returning();

    if (!deleted) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Entry not found' } }, 404);
    }

    return c.json({ message: 'Entry deleted' });
  });

  return app;
}
