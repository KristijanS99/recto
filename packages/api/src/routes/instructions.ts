import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Database } from '../db/connection.js';
import { instructions } from '../db/schema.js';
import { DEFAULT_INSTRUCTIONS } from '../db/seed.js';
import { updateInstructionsSchema } from '../types.js';

export function instructionsRoutes(db: Database) {
  const app = new Hono();

  app.get('/', async (c) => {
    const [row] = await db.select().from(instructions);
    if (!row) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'No instructions found' } }, 404);
    }
    return c.json(row);
  });

  app.put('/', zValidator('json', updateInstructionsSchema), async (c) => {
    const { content } = c.req.valid('json');
    const [row] = await db.select().from(instructions);
    if (!row) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'No instructions found' } }, 404);
    }
    const [updated] = await db
      .update(instructions)
      .set({ content })
      .where(eq(instructions.id, row.id))
      .returning();
    return c.json(updated);
  });

  app.post('/reset', async (c) => {
    const [row] = await db.select().from(instructions);
    if (!row) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'No instructions found' } }, 404);
    }
    const [updated] = await db
      .update(instructions)
      .set({ content: DEFAULT_INSTRUCTIONS })
      .where(eq(instructions.id, row.id))
      .returning();
    return c.json(updated);
  });

  return app;
}
