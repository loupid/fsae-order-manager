import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db as defaultDb } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes the DDL schema against the specified SQLite database.
 * @param {import('better-sqlite3').Database} [targetDb] - Database instance to migrate.
 * @returns {{ success: boolean, tables: string[], indexes: string[] }}
 */
export function runMigrations(targetDb = defaultDb) {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at: ${schemaPath}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Execute DDL schema inside a transaction
  targetDb.exec(schemaSql);

  // Ensure non-breaking optional columns exist on existing databases
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(users)").all();
    const existingCols = tableInfo.map(col => col.name);
    const needed = ['department', 'subsystem', 'discord_handle', 'tshirt_size'];
    for (const col of needed) {
      if (!existingCols.includes(col)) {
        targetDb.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
      }
    }
  } catch (e) {
    // Ignore if table is being initialized
  }

  const tables = targetDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map(row => row.name);

  const indexes = targetDb
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map(row => row.name);

  console.log(`[MIGRATE] Schema migrated successfully.`);
  console.log(`[MIGRATE] Tables (${tables.length}): ${tables.join(', ')}`);
  console.log(`[MIGRATE] Indexes (${indexes.length}): ${indexes.join(', ')}`);

  return { success: true, tables, indexes };
}

// CLI Execution Support
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    runMigrations();
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATE] Migration failed:', err);
    process.exit(1);
  }
}
