import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { initDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { runSeed } from '../db/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// If this file is executed as a worker thread for concurrency stress test
if (!isMainThread) {
  const { dbPath, workerId, operationsCount } = workerData;
  const workerDb = initDatabase(dbPath);
  workerDb.pragma('busy_timeout = 5000');

  try {
    const member = workerDb.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
    const powSub = workerDb.prepare('SELECT id FROM subsystems WHERE code = ?').get('POW');

    const insertStmt = workerDb.prepare(`
      INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, urgency_level, status)
      VALUES (?, ?, 'DigiKey', ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < operationsCount; i++) {
      const sku = `W${workerId}-ITEM-${i}`;
      const desc = `Concurrent stress item from worker ${workerId} iteration ${i}`;
      const qty = (i % 5) + 1;
      const price = 10.50 + i;
      const urgency = i % 3 === 0 ? 'CRITICAL' : (i % 2 === 0 ? 'URGENT' : 'NORMAL');
      const status = 'SUBMITTED';

      insertStmt.run(member.id, powSub.id, sku, desc, qty, price, urgency, status);

      // Interleaved read query
      const count = workerDb.prepare('SELECT count(*) as total FROM part_requests').get().total;
      if (count <= 0) {
        throw new Error('Inconsistent read during concurrency test');
      }
    }

    workerDb.close();
    parentPort.postMessage({ success: true, workerId, operationsCompleted: operationsCount });
  } catch (err) {
    if (workerDb) workerDb.close();
    parentPort.postMessage({ success: false, workerId, error: err.message });
  }
} else {
  // Main test suite runner
  console.log('\n=============================================================');
  console.log('🔥 RUNNING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (M1) 🔥');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function runTest(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Details: ${err.message}`);
      failed++;
    }
  }

  async function runAsyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Details: ${err.message}`);
      failed++;
    }
  }

  // Setup in-memory test database for deterministic constraint fuzzing
  const db = initDatabase(':memory:');
  runMigrations(db);
  runSeed(db);

  // SECTION 1: FOREIGN KEY VIOLATIONS & INTEGRITY
  console.log('\n--- [1] Foreign Key Violation Challenges ---');

  runTest('FK-01: Reject part_requests with invalid requester_id (-1, 999999, NULL)', () => {
    const sub = db.prepare('SELECT id FROM subsystems LIMIT 1').get();
    
    assert.throws(() => {
      db.prepare(`INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description) VALUES (-1, ?, 'DigiKey', 'SKU1', 'Test')`).run(sub.id);
    }, /FOREIGN KEY constraint failed/i);

    assert.throws(() => {
      db.prepare(`INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description) VALUES (999999, ?, 'DigiKey', 'SKU2', 'Test')`).run(sub.id);
    }, /FOREIGN KEY constraint failed/i);

    assert.throws(() => {
      db.prepare(`INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description) VALUES (NULL, ?, 'DigiKey', 'SKU3', 'Test')`).run(sub.id);
    }, /NOT NULL constraint failed/i);
  });

  runTest('FK-02: Reject part_requests with invalid subsystem_id (-1, 999999, NULL)', () => {
    const user = db.prepare('SELECT id FROM users LIMIT 1').get();

    assert.throws(() => {
      db.prepare(`INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description) VALUES (?, -1, 'DigiKey', 'SKU4', 'Test')`).run(user.id);
    }, /FOREIGN KEY constraint failed/i);

    assert.throws(() => {
      db.prepare(`INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description) VALUES (?, 999999, 'DigiKey', 'SKU5', 'Test')`).run(user.id);
    }, /FOREIGN KEY constraint failed/i);

    assert.throws(() => {
      db.prepare(`INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description) VALUES (?, NULL, 'DigiKey', 'SKU6', 'Test')`).run(user.id);
    }, /NOT NULL constraint failed/i);
  });

  runTest('FK-03: Reject part_requests with invalid po_id (non-existent)', () => {
    const user = db.prepare('SELECT id FROM users LIMIT 1').get();
    const sub = db.prepare('SELECT id FROM subsystems LIMIT 1').get();

    assert.throws(() => {
      db.prepare(`INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, po_id) VALUES (?, ?, 'DigiKey', 'SKU7', 'Test', 999999)`).run(user.id, sub.id);
    }, /FOREIGN KEY constraint failed/i);
  });

  runTest('FK-04: Reject purchase_orders with invalid purchaser_id (-1, 999999, NULL)', () => {
    assert.throws(() => {
      db.prepare(`INSERT INTO purchase_orders (po_number, supplier, purchaser_id) VALUES ('PO-FK-01', 'Mouser', -1)`).run();
    }, /FOREIGN KEY constraint failed/i);

    assert.throws(() => {
      db.prepare(`INSERT INTO purchase_orders (po_number, supplier, purchaser_id) VALUES ('PO-FK-02', 'Mouser', 999999)`).run();
    }, /FOREIGN KEY constraint failed/i);

    assert.throws(() => {
      db.prepare(`INSERT INTO purchase_orders (po_number, supplier, purchaser_id) VALUES ('PO-FK-03', 'Mouser', NULL)`).run();
    }, /NOT NULL constraint failed/i);
  });

  runTest('FK-05: Reject invoices with invalid po_id (-1, 999999, NULL)', () => {
    assert.throws(() => {
      db.prepare(`INSERT INTO invoices (po_id, file_name, file_path, amount) VALUES (-1, 'test.pdf', 'uploads/test.pdf', 10.0)`).run();
    }, /FOREIGN KEY constraint failed/i);

    assert.throws(() => {
      db.prepare(`INSERT INTO invoices (po_id, file_name, file_path, amount) VALUES (999999, 'test.pdf', 'uploads/test.pdf', 10.0)`).run();
    }, /FOREIGN KEY constraint failed/i);

    assert.throws(() => {
      db.prepare(`INSERT INTO invoices (po_id, file_name, file_path, amount) VALUES (NULL, 'test.pdf', 'uploads/test.pdf', 10.0)`).run();
    }, /NOT NULL constraint failed/i);
  });

  runTest('FK-06: Prevent deletion of user referenced by existing part_requests (ON DELETE RESTRICT)', () => {
    const member = db.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
    assert.throws(() => {
      db.prepare('DELETE FROM users WHERE id = ?').run(member.id);
    }, /FOREIGN KEY constraint failed/i);
  });

  runTest('FK-07: Prevent deletion of subsystem referenced by existing part_requests (ON DELETE RESTRICT)', () => {
    const pow = db.prepare('SELECT id FROM subsystems WHERE code = ?').get('POW');
    assert.throws(() => {
      db.prepare('DELETE FROM subsystems WHERE id = ?').run(pow.id);
    }, /FOREIGN KEY constraint failed/i);
  });

  // SECTION 2: CHECK CONSTRAINT VIOLATIONS
  console.log('\n--- [2] CHECK Constraint Violation Challenges ---');

  runTest('CHECK-01: Reject invalid urgency levels (EXTREME, normal, CRITIQUE, SuperUrgent, empty string)', () => {
    const member = db.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
    const pow = db.prepare('SELECT id FROM subsystems WHERE code = ?').get('POW');

    const invalidUrgencies = ['EXTREME', 'normal', 'urgent', 'critical', 'CRITIQUE', 'SuperUrgent', '', 'URGENT_NOW'];
    for (const badUrgency of invalidUrgencies) {
      assert.throws(() => {
        db.prepare(`
          INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, urgency_level)
          VALUES (?, ?, 'DigiKey', 'SKU-BAD-URG', 'Test Urgency', ?)
        `).run(member.id, pow.id, badUrgency);
      }, /CHECK constraint failed/i, `Should reject urgency_level: ${badUrgency}`);
    }
  });

  runTest('CHECK-02: Reject invalid user roles (Owner, SuperAdmin, member, ADMIN, Guest, root, empty string)', () => {
    const invalidRoles = ['Owner', 'SuperAdmin', 'member', 'purchaser', 'admin', 'ADMIN', 'Guest', 'root', ''];
    for (const badRole of invalidRoles) {
      assert.throws(() => {
        db.prepare(`
          INSERT INTO users (name, email, password_hash, role)
          VALUES ('Bad User', ?, 'fakehash', ?)
        `).run(`bad_${Math.random()}@fsae.org`, badRole);
      }, /CHECK constraint failed/i, `Should reject role: ${badRole}`);
    }
  });

  runTest('CHECK-03: Reject negative price (unit_price_est < 0) and negative invoice amount (amount < 0)', () => {
    const member = db.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
    const pow = db.prepare('SELECT id FROM subsystems WHERE code = ?').get('POW');
    const po = db.prepare('SELECT id FROM purchase_orders LIMIT 1').get();

    // Negative unit price
    assert.throws(() => {
      db.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, unit_price_est)
        VALUES (?, ?, 'DigiKey', 'SKU-NEG-P', 'Test Neg Price', -0.01)
      `).run(member.id, pow.id);
    }, /CHECK constraint failed/i);

    assert.throws(() => {
      db.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, unit_price_est)
        VALUES (?, ?, 'DigiKey', 'SKU-NEG-P2', 'Test Neg Price', -500.0)
      `).run(member.id, pow.id);
    }, /CHECK constraint failed/i);

    // Negative invoice amount
    assert.throws(() => {
      db.prepare(`
        INSERT INTO invoices (po_id, file_name, file_path, amount)
        VALUES (?, 'inv_neg.pdf', 'uploads/inv_neg.pdf', -0.01)
      `).run(po.id);
    }, /CHECK constraint failed/i);
  });

  runTest('CHECK-04: Reject negative or zero quantity (quantity <= 0)', () => {
    const member = db.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
    const pow = db.prepare('SELECT id FROM subsystems WHERE code = ?').get('POW');

    // Zero quantity
    assert.throws(() => {
      db.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity)
        VALUES (?, ?, 'DigiKey', 'SKU-ZERO-Q', 'Test Zero Qty', 0)
      `).run(member.id, pow.id);
    }, /CHECK constraint failed/i);

    // Negative quantity
    assert.throws(() => {
      db.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity)
        VALUES (?, ?, 'DigiKey', 'SKU-NEG-Q', 'Test Neg Qty', -1)
      `).run(member.id, pow.id);
    }, /CHECK constraint failed/i);
  });

  runTest('CHECK-05: Reject negative allocated budget on subsystems (budget_allocated < 0)', () => {
    assert.throws(() => {
      db.prepare(`
        INSERT INTO subsystems (name, code, budget_allocated)
        VALUES ('Negative Subsystem', 'NEG1', -0.01)
      `).run();
    }, /CHECK constraint failed/i);

    assert.throws(() => {
      db.prepare(`
        INSERT INTO subsystems (name, code, budget_allocated)
        VALUES ('Negative Subsystem 2', 'NEG2', -1000.00)
      `).run();
    }, /CHECK constraint failed/i);
  });

  runTest('CHECK-06: Reject negative total_cost on purchase_orders (total_cost < 0)', () => {
    const purchaser = db.prepare('SELECT id FROM users WHERE email = ?').get('purchaser@fsae.org');
    assert.throws(() => {
      db.prepare(`
        INSERT INTO purchase_orders (po_number, supplier, purchaser_id, total_cost)
        VALUES ('PO-NEG-COST', 'Mouser', ?, -1.0)
      `).run(purchaser.id);
    }, /CHECK constraint failed/i);
  });

  runTest('CHECK-07: Reject invalid status transitions / enum values on purchase_orders and part_requests', () => {
    const purchaser = db.prepare('SELECT id FROM users WHERE email = ?').get('purchaser@fsae.org');
    const member = db.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
    const pow = db.prepare('SELECT id FROM subsystems WHERE code = ?').get('POW');

    // Invalid PO status
    assert.throws(() => {
      db.prepare(`
        INSERT INTO purchase_orders (po_number, supplier, purchaser_id, status)
        VALUES ('PO-INV-STAT', 'DigiKey', ?, 'IN_TRANSIT')
      `).run(purchaser.id);
    }, /CHECK constraint failed/i);

    // Invalid PartRequest status
    assert.throws(() => {
      db.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, status)
        VALUES (?, ?, 'DigiKey', 'SKU-INV-STAT', 'Invalid Status', 'ARCHIVED')
      `).run(member.id, pow.id);
    }, /CHECK constraint failed/i);
  });

  // SECTION 3: DUPLICATE & UNIQUENESS CONSTRAINTS
  console.log('\n--- [3] Duplicate & Uniqueness Constraint Challenges ---');

  runTest('UNIQUE-01: Reject duplicate email case-insensitively (COLLATE NOCASE)', () => {
    // member@fsae.org is already seeded
    const variations = ['member@fsae.org', 'MEMBER@FSAE.ORG', 'Member@Fsae.Org', 'mEmBeR@fSaE.oRg'];
    for (const emailVar of variations) {
      assert.throws(() => {
        db.prepare(`
          INSERT INTO users (name, email, password_hash, role)
          VALUES ('Duplicate Member', ?, 'fakehash', 'Member')
        `).run(emailVar);
      }, /UNIQUE constraint failed/i, `Should reject case variation: ${emailVar}`);
    }
  });

  runTest('UNIQUE-02: Reject duplicate subsystem code', () => {
    // POW is already seeded
    assert.throws(() => {
      db.prepare(`
        INSERT INTO subsystems (name, code, budget_allocated)
        VALUES ('Powertrain 2', 'POW', 1000.0)
      `).run();
    }, /UNIQUE constraint failed/i);
  });

  runTest('UNIQUE-03: Reject duplicate purchase order number (po_number)', () => {
    const purchaser = db.prepare('SELECT id FROM users WHERE email = ?').get('purchaser@fsae.org');
    // PO-2026-0001 is already seeded
    assert.throws(() => {
      db.prepare(`
        INSERT INTO purchase_orders (po_number, supplier, purchaser_id, total_cost)
        VALUES ('PO-2026-0001', 'DigiKey', ?, 100.0)
      `).run(purchaser.id);
    }, /UNIQUE constraint failed/i);
  });

  // SECTION 4: DATA INTEGRITY, TRANSACTIONS & ROLLBACK
  console.log('\n--- [4] ACID Transaction Rollback Challenges ---');

  runTest('TX-01: Transaction rolls back cleanly on error without partial insertions', () => {
    const member = db.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
    const pow = db.prepare('SELECT id FROM subsystems WHERE code = ?').get('POW');

    const countBefore = db.prepare('SELECT count(*) as total FROM part_requests').get().total;

    assert.throws(() => {
      const atomicTx = db.transaction(() => {
        db.prepare(`
          INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description)
          VALUES (?, ?, 'DigiKey', 'TX-PART-1', 'Tx Item 1')
        `).run(member.id, pow.id);

        // Intentionally cause failure on 2nd insert
        db.prepare(`
          INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, urgency_level)
          VALUES (?, ?, 'DigiKey', 'TX-PART-2', 'Tx Item 2', 'INVALID_URGENCY')
        `).run(member.id, pow.id);
      });

      atomicTx();
    }, /CHECK constraint failed/i);

    const countAfter = db.prepare('SELECT count(*) as total FROM part_requests').get().total;
    assert.equal(countAfter, countBefore, 'Database count must remain identical after rolled-back transaction');

    const orphan = db.prepare('SELECT * FROM part_requests WHERE sku = ?').get('TX-PART-1');
    assert.equal(orphan, undefined, 'First insert inside aborted transaction must be completely rolled back');
  });

  // SECTION 5: SQLITE WAL MODE CONCURRENCY UNDER HEAVY LOAD
  console.log('\n--- [5] SQLite WAL Concurrency Stress Testing ---');

  await runAsyncTest('WAL-01: Multi-threaded worker stress testing with 50+ concurrent transactions in WAL mode', async () => {
    const diskDbPath = path.resolve(process.cwd(), 'data', 'test_adversarial_wal.db');
    if (fs.existsSync(diskDbPath)) fs.unlinkSync(diskDbPath);
    if (fs.existsSync(`${diskDbPath}-wal`)) fs.unlinkSync(`${diskDbPath}-wal`);
    if (fs.existsSync(`${diskDbPath}-shm`)) fs.unlinkSync(`${diskDbPath}-shm`);

    // Initialize disk DB and run migrations + seed
    const diskDb = initDatabase(diskDbPath);
    runMigrations(diskDb);
    runSeed(diskDb);

    // Verify WAL mode is indeed set on disk database
    const journalMode = diskDb.pragma('journal_mode', { simple: true });
    assert.equal(journalMode.toLowerCase(), 'wal', 'Disk database must be in WAL journal mode');

    diskDb.close();

    const workerCount = 5;
    const opsPerWorker = 20; // 5 x 20 = 100 concurrent insertions + 100 concurrent reads
    const workerPromises = [];

    for (let w = 0; w < workerCount; w++) {
      const p = new Promise((resolve, reject) => {
        const worker = new Worker(__filename, {
          workerData: {
            dbPath: diskDbPath,
            workerId: w,
            operationsCount: opsPerWorker
          }
        });

        worker.on('message', (msg) => {
          if (msg.success) resolve(msg);
          else reject(new Error(`Worker ${msg.workerId} failed: ${msg.error}`));
        });

        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
      });

      workerPromises.push(p);
    }

    const results = await Promise.all(workerPromises);
    assert.equal(results.length, workerCount, `All ${workerCount} workers must finish successfully`);

    // Reconnect and perform post-stress integrity check
    const verifyDb = initDatabase(diskDbPath);
    const integrityCheck = verifyDb.pragma('integrity_check');
    assert.equal(integrityCheck[0].integrity_check, 'ok', 'SQLite integrity check must return "ok"');

    const quickCheck = verifyDb.pragma('quick_check');
    assert.equal(quickCheck[0].quick_check, 'ok', 'SQLite quick check must return "ok"');

    const totalRequests = verifyDb.prepare('SELECT count(*) as total FROM part_requests').get().total;
    // 8 seeded requests + (5 workers * 20 operations = 100 new requests) = 108 total
    assert.equal(totalRequests, 8 + (workerCount * opsPerWorker), `Expected 108 total part requests, got ${totalRequests}`);

    verifyDb.close();

    // Clean up temporary stress database files
    try {
      if (fs.existsSync(diskDbPath)) fs.unlinkSync(diskDbPath);
      if (fs.existsSync(`${diskDbPath}-wal`)) fs.unlinkSync(`${diskDbPath}-wal`);
      if (fs.existsSync(`${diskDbPath}-shm`)) fs.unlinkSync(`${diskDbPath}-shm`);
    } catch (cleanupErr) {
      // Non-critical file handle cleanup
    }
  });

  console.log(`\n=============================================================`);
  console.log(`📊 ADVERSARIAL STRESS TEST RESULTS:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    console.error('❌ ADVERSARIAL CHALLENGES FAILED');
    process.exit(1);
  } else {
    console.log('🏆 ALL ADVERSARIAL STRESS CHALLENGES PASSED WITH ZERO ERRORS!\n');
    if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
      process.exit(0);
    }
  }
}
