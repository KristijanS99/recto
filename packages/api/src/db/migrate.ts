import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Database } from './connection.js';

export async function runMigrations(db: Database) {
  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
  console.log('Migrations complete.');
}
