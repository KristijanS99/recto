import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Database } from './connection.js';

export async function runMigrations(db: Database) {
  console.log('Running database migrations...');
  // resolve from dist/ -> ../drizzle (works both in source and bundled output)
  const migrationsFolder = resolve(import.meta.dirname, '..', 'drizzle');
  await migrate(db, { migrationsFolder });
  console.log('Migrations complete.');
}
