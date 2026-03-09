import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createLogger } from '../lib/logger.js';
import type { Database } from './connection.js';
import { instructions, prompts } from './schema.js';
import { DEFAULT_INSTRUCTIONS, DEFAULT_PROMPTS } from './seed.js';

const logger = createLogger('migrate');

export async function runMigrations(db: Database) {
  logger.info('Running database migrations');
  const migrationsFolder = resolve(import.meta.dirname, '..', 'drizzle');
  await migrate(db, { migrationsFolder });
  logger.info('Migrations complete');
  await seedDefaults(db);
}

async function seedDefaults(db: Database) {
  const existingInstructions = await db.select().from(instructions);
  if (existingInstructions.length === 0) {
    logger.info('Seeding default instructions');
    await db.insert(instructions).values({ content: DEFAULT_INSTRUCTIONS });
  }

  const existingPrompts = await db.select().from(prompts);
  if (existingPrompts.length === 0) {
    logger.info('Seeding default prompts');
    await db.insert(prompts).values(DEFAULT_PROMPTS);
  }
}
