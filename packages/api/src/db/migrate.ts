import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Database } from './connection.js';
import { instructions, prompts } from './schema.js';
import { DEFAULT_INSTRUCTIONS, DEFAULT_PROMPTS } from './seed.js';

export async function runMigrations(db: Database) {
  console.log('Running database migrations...');
  const migrationsFolder = resolve(import.meta.dirname, '..', 'drizzle');
  await migrate(db, { migrationsFolder });
  console.log('Migrations complete.');
  await seedDefaults(db);
}

async function seedDefaults(db: Database) {
  const existingInstructions = await db.select().from(instructions);
  if (existingInstructions.length === 0) {
    console.log('Seeding default instructions...');
    await db.insert(instructions).values({ content: DEFAULT_INSTRUCTIONS });
  }

  const existingPrompts = await db.select().from(prompts);
  if (existingPrompts.length === 0) {
    console.log('Seeding default prompts...');
    await db.insert(prompts).values(DEFAULT_PROMPTS);
  }
}
