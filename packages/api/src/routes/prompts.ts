import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTP_STATUS } from '../constants.js';
import type { Database } from '../db/connection.js';
import { prompts } from '../db/schema.js';
import { DEFAULT_PROMPTS } from '../db/seed.js';
import { badRequest, internalError, notFound } from '../lib/responses.js';
import { createPromptSchema, updatePromptSchema, uuidParam } from '../types.js';

export function promptsRoutes(db: Database) {
  const app = new Hono();

  app.get('/', async (c) => {
    const all = await db.select().from(prompts);
    return c.json({ data: all });
  });

  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const parsed = uuidParam.safeParse(id);
    if (!parsed.success) return badRequest(c, 'Invalid ID format');
    const [row] = await db.select().from(prompts).where(eq(prompts.id, id));
    if (!row) {
      return notFound(c, 'Prompt not found');
    }
    return c.json(row);
  });

  app.post('/', zValidator('json', createPromptSchema), async (c) => {
    const body = c.req.valid('json');
    const [created] = await db
      .insert(prompts)
      .values({ ...body, isDefault: false })
      .returning();
    return c.json(created, HTTP_STATUS.CREATED);
  });

  app.put('/:id', zValidator('json', updatePromptSchema), async (c) => {
    const id = c.req.param('id');
    const parsed = uuidParam.safeParse(id);
    if (!parsed.success) return badRequest(c, 'Invalid ID format');
    const body = c.req.valid('json');
    const [existing] = await db.select().from(prompts).where(eq(prompts.id, id));
    if (!existing) {
      return notFound(c, 'Prompt not found');
    }
    const [updated] = await db.update(prompts).set(body).where(eq(prompts.id, id)).returning();
    return c.json(updated);
  });

  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const parsed = uuidParam.safeParse(id);
    if (!parsed.success) return badRequest(c, 'Invalid ID format');
    const [existing] = await db.select().from(prompts).where(eq(prompts.id, id));
    if (!existing) {
      return notFound(c, 'Prompt not found');
    }
    if (existing.isDefault) {
      return badRequest(c, 'Cannot delete a default prompt. Use reset instead.');
    }
    await db.delete(prompts).where(eq(prompts.id, id));
    return c.json({ message: 'Prompt deleted' });
  });

  app.post('/:id/reset', async (c) => {
    const id = c.req.param('id');
    const parsed = uuidParam.safeParse(id);
    if (!parsed.success) return badRequest(c, 'Invalid ID format');
    const [existing] = await db.select().from(prompts).where(eq(prompts.id, id));
    if (!existing) {
      return notFound(c, 'Prompt not found');
    }
    if (!existing.isDefault) {
      return badRequest(c, 'Only default prompts can be reset');
    }
    const defaultData = DEFAULT_PROMPTS.find((p) => p.name === existing.name);
    if (!defaultData) {
      return internalError(c, 'Default data not found');
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
