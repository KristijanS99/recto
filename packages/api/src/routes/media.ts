import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Database } from '../db/connection.js';
import { entries, type MediaItem } from '../db/schema.js';
import { addMediaSchema } from '../types.js';

export function mediaRoutes(db: Database) {
  const app = new Hono();

  // POST /entries/:id/media — Add media reference
  app.post('/:id/media', zValidator('json', addMediaSchema), async (c) => {
    const id = c.req.param('id');
    const mediaItem = c.req.valid('json');

    const [entry] = await db.select().from(entries).where(eq(entries.id, id));
    if (!entry) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Entry not found' } }, 404);
    }

    const media = [...(entry.media ?? []), mediaItem as MediaItem];

    const [updated] = await db.update(entries).set({ media }).where(eq(entries.id, id)).returning();

    return c.json(updated, 201);
  });

  // DELETE /entries/:id/media/:index — Remove media by index
  app.delete('/:id/media/:index', async (c) => {
    const id = c.req.param('id');
    const index = Number.parseInt(c.req.param('index'), 10);

    if (Number.isNaN(index) || index < 0) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid media index' } }, 400);
    }

    const [entry] = await db.select().from(entries).where(eq(entries.id, id));
    if (!entry) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Entry not found' } }, 404);
    }

    const media = entry.media ?? [];
    if (index >= media.length) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Media index out of range' } }, 404);
    }

    const updated_media = media.filter((_, i) => i !== index);

    const [updated] = await db
      .update(entries)
      .set({ media: updated_media })
      .where(eq(entries.id, id))
      .returning();

    return c.json(updated);
  });

  return app;
}
