import { eq } from 'drizzle-orm';
import type { Database } from '../db/connection.js';
import { entries } from '../db/schema.js';

export async function findEntryById(db: Database, id: string) {
  const [entry] = await db.select().from(entries).where(eq(entries.id, id));
  return entry ?? null;
}
