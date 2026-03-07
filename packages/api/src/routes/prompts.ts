import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Database } from '../db/connection.js';
import { prompts } from '../db/schema.js';
import { DEFAULT_PROMPTS } from '../db/seed.js';
import { createPromptSchema, updatePromptSchema } from '../types.js';

export function promptsRoutes(db: Database) {
  const app = new Hono();

  app.get('/', async (c) => {
    const all = await db.select().from(prompts);
    return c.json({ data: all });
  });

  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const [row] = await db.select().from(prompts).where(eq(prompts.id, id));
    if (!row) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Prompt not found' } }, 404);
    }
    return c.json(row);
  });

  app.post('/', zValidator('json', createPromptSchema), async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(prompts)
      .values({ ...body, isDefault: false })
      .returning();
    return c.json(created, 201);
  });

  app.put('/:id', zValidator('json', updatePromptSchema), async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const [existing] = await db.select().from(prompts).where(eq(prompts.id, id));
    if (!existing) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Prompt not found' } }, 404);
    }
    const [updated] = await db.update(prompts).set(body).where(eq(prompts.id, id)).returning();
    return c.json(updated);
  });

  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(prompts).where(eq(prompts.id, id));
    if (!existing) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Prompt not found' } }, 404);
    }
    if (existing.isDefault) {
      return c.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Cannot delete a default prompt. Use reset instead.',
          },
        },
        400,
      );
    }
    await db.delete(prompts).where(eq(prompts.id, id));
    return c.json({ message: 'Prompt deleted' });
  });

  app.post('/:id/reset', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(prompts).where(eq(prompts.id, id));
    if (!existing) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Prompt not found' } }, 404);
    }
    if (!existing.isDefault) {
      return c.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Only default prompts can be reset',
          },
        },
        400,
      );
    }
    const defaultData = DEFAULT_PROMPTS.find((p) => p.name === existing.name);
    if (!defaultData) {
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Default data not found' } }, 500);
    }
    const [updated] = await db
      .update(prompts)
      .set({ description: defaultData.description, content: defaultData.content })
      .where(eq(prompts.id, id))
      .returning();
    return c.json(updated);
  });

  return app;
}
