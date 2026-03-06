import { loadConfig } from './config.js';
import { createDb } from './db/connection.js';
import { runMigrations } from './db/migrate.js';

async function main() {
  const config = loadConfig();
  const { db } = createDb(config.DATABASE_URL);

  await runMigrations(db);

  console.log(`@recto/api listening on port ${config.API_PORT}`);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
