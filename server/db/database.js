import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Resolves the database file path based on environment mode (prod, dev, test).
 * @param {string} [customPath]
 * @returns {string}
 */
export function getDbPath(customPath) {
  if (customPath) return customPath;
  if (process.env.DB_PATH) return process.env.DB_PATH;

  const mode = (process.env.NODE_ENV || 'development').toLowerCase();
  let filename = 'fsae_orders.db';
  if (mode === 'production') {
    filename = 'fsae_orders_prod.db';
  } else if (mode === 'development' || mode === 'debug') {
    filename = 'fsae_orders_dev.db';
  }
  return path.resolve(process.cwd(), 'data', filename);
}

/**
 * Initializes a SQLite database connection with WAL mode and foreign keys enabled.
 * @param {string} [customPath] - Optional custom path or ':memory:' for testing.
 * @returns {Database.Database} SQLite database instance.
 */
export function initDatabase(customPath) {
  const dbPath = getDbPath(customPath);

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath, {
    timeout: 5000,
  });

  // Enable WAL mode for high concurrency and flash storage longevity
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  return db;
}

// Default singleton database instance for application runtime
const db = initDatabase();

export default db;
export { db };
