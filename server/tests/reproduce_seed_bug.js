import Database from 'better-sqlite3';
import { initDatabase } from '../db/database.js';
import { runSeed } from '../db/seed.js';

console.log('--- REPRODUCING SEED IDEMPOTENCY BUG ---');

const db = initDatabase(':memory:');

console.log('Run 1: Seeding database first time...');
try {
  runSeed(db);
  console.log('Run 1: SUCCESS');
} catch (e) {
  console.error('Run 1 failed:', e.message);
}

console.log('\nRun 2: Seeding database second time (should be idempotent)...');
try {
  runSeed(db);
  console.log('Run 2: SUCCESS');
} catch (e) {
  console.error('Run 2 FAILED with error:', e.message);
  console.error('Stack:', e.stack);
}
