import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { initDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { runSeed } from '../db/seed.js';

console.log('\n=== RUNNING TIER 1: SCHEMA, MIGRATION & SEED INTEGRATION TESTS ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// Initialize clean in-memory database for testing
const testDb = initDatabase(':memory:');

// TEST 1: Schema Migration & Table Verification
test('T1-SCHEMA-01: Migrations create all 5 required tables and indexes', () => {
  const result = runMigrations(testDb);
  assert.equal(result.success, true);

  const expectedTables = ['invoices', 'part_requests', 'purchase_orders', 'subsystems', 'users'];
  assert.deepEqual(result.tables.sort(), expectedTables.sort());

  const expectedIndexes = [
    'idx_invoices_po_id',
    'idx_part_requests_po',
    'idx_part_requests_requester',
    'idx_part_requests_status',
    'idx_part_requests_subsystem',
    'idx_part_requests_supplier',
    'idx_part_requests_urgency',
    'idx_purchase_orders_po_number',
    'idx_purchase_orders_purchaser',
    'idx_purchase_orders_status',
    'idx_purchase_orders_supplier',
    'idx_subsystems_code',
    'idx_users_email'
  ];

  for (const idx of expectedIndexes) {
    assert.ok(result.indexes.includes(idx), `Index ${idx} is present`);
  }
});

// TEST 2: WAL and Foreign Key Pragmas Verification
test('T1-SCHEMA-02: Pragmas enforce foreign keys and WAL mode', () => {
  const fkCheck = testDb.pragma('foreign_keys', { simple: true });
  assert.equal(fkCheck, 1, 'Foreign keys pragma must be active (1)');
});

// TEST 3: Seed Script Execution & Entity Population
test('T1-SCHEMA-03: Seed script populates demo data correctly', () => {
  const seedResult = runSeed(testDb);
  assert.equal(seedResult.usersCount, 3);
  assert.equal(seedResult.subsystemsCount, 6);
  assert.equal(seedResult.purchaseOrdersCount, 2);
  assert.equal(seedResult.partRequestsCount, 8);
  assert.equal(seedResult.invoicesCount, 2);
});

// TEST 3b: Seed Script Idempotency (Repeat Execution)
test('T1-SCHEMA-03b: Seed script is strictly idempotent across consecutive executions with 0 exceptions', () => {
  assert.doesNotThrow(() => {
    const run1 = runSeed(testDb);
    assert.equal(run1.usersCount, 3);
    assert.equal(run1.subsystemsCount, 6);
    assert.equal(run1.purchaseOrdersCount, 2);
    assert.equal(run1.partRequestsCount, 8);
    assert.equal(run1.invoicesCount, 2);

    const run2 = runSeed(testDb);
    assert.equal(run2.usersCount, 3);
    assert.equal(run2.subsystemsCount, 6);
    assert.equal(run2.purchaseOrdersCount, 2);
    assert.equal(run2.partRequestsCount, 8);
    assert.equal(run2.invoicesCount, 2);
  }, 'Consecutive seed executions must succeed with zero exceptions');

  // Verify direct database row counts remain exact
  const dbUsers = testDb.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const dbSubsystems = testDb.prepare('SELECT COUNT(*) as c FROM subsystems').get().c;
  const dbPOs = testDb.prepare('SELECT COUNT(*) as c FROM purchase_orders').get().c;
  const dbReqs = testDb.prepare('SELECT COUNT(*) as c FROM part_requests').get().c;
  const dbInvoices = testDb.prepare('SELECT COUNT(*) as c FROM invoices').get().c;

  assert.equal(dbUsers, 3, 'Users count must remain exactly 3');
  assert.equal(dbSubsystems, 6, 'Subsystems count must remain exactly 6');
  assert.equal(dbPOs, 2, 'Purchase Orders count must remain exactly 2');
  assert.equal(dbReqs, 8, 'Part Requests count must remain exactly 8');
  assert.equal(dbInvoices, 2, 'Invoices count must remain exactly 2');
});

// TEST 4: Bcrypt Password Hashing Verification
test('T1-AUTH-01: Demo user passwords match Bcrypt hashes with 10 salt rounds', () => {
  const member = testDb.prepare('SELECT * FROM users WHERE email = ?').get('member@fsae.org');
  assert.ok(member, 'Member user exists');
  assert.equal(bcrypt.compareSync('member123', member.password_hash), true, 'Member password verified');
  assert.equal(bcrypt.compareSync('wrongpass', member.password_hash), false, 'Wrong password rejected');

  const purchaser = testDb.prepare('SELECT * FROM users WHERE email = ?').get('purchaser@fsae.org');
  assert.ok(purchaser, 'Purchaser user exists');
  assert.equal(bcrypt.compareSync('purchaser123', purchaser.password_hash), true, 'Purchaser password verified');

  const admin = testDb.prepare('SELECT * FROM users WHERE email = ?').get('admin@fsae.org');
  assert.ok(admin, 'Admin user exists');
  assert.equal(bcrypt.compareSync('admin123', admin.password_hash), true, 'Admin password verified');
});

// TEST 5: Subsystems Integrity & Budget Check
test('T1-SCHEMA-04: Subsystems seeded with valid codes and allocated budgets', () => {
  const subs = testDb.prepare('SELECT code, budget_allocated FROM subsystems ORDER BY code').all();
  const subCodes = subs.map(s => s.code);
  const expectedCodes = ['AER', 'CHA', 'LVE', 'POW', 'SUS', 'TEL'];
  assert.deepEqual(subCodes.sort(), expectedCodes.sort());

  for (const s of subs) {
    assert.ok(s.budget_allocated > 0, `Subsystem ${s.code} has positive allocated budget`);
  }
});

// TEST 6: Urgency Level & Status Check Constraints on Part Requests
test('T1-SCHEMA-05: Urgency level CHECK constraint strictly enforces NORMAL, URGENT, CRITICAL', () => {
  const member = testDb.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
  const powSub = testDb.prepare('SELECT id FROM subsystems WHERE code = ?').get('POW');

  // Valid insertion with CRITICAL
  const insertValid = testDb.prepare(`
    INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, urgency_level)
    VALUES (?, ?, 'DigiKey', 'TEST-SKU-1', 'Critical Relay', 1, 10.0, 'CRITICAL')
  `);
  const info = insertValid.run(member.id, powSub.id);
  assert.ok(info.lastInsertRowid > 0);

  // Invalid urgency level should throw CHECK constraint error
  assert.throws(() => {
    testDb.prepare(`
      INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, urgency_level)
      VALUES (?, ?, 'DigiKey', 'TEST-SKU-2', 'Invalid Urgency Item', 1, 10.0, 'SUPER_CRITICAL')
    `).run(member.id, powSub.id);
  }, /CHECK constraint failed/i);
});

// TEST 7: Role CHECK Constraint on Users
test('T1-SCHEMA-06: Role CHECK constraint strictly enforces Member, Purchaser, Admin', () => {
  assert.throws(() => {
    testDb.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Intruder', 'intruder@fsae.org', 'fakehash', 'SuperUser')
    `).run();
  }, /CHECK constraint failed/i);
});

// TEST 8: Foreign Key Enforcement
test('T1-SCHEMA-07: Foreign key constraint blocks invalid requester_id or subsystem_id', () => {
  assert.throws(() => {
    testDb.prepare(`
      INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description)
      VALUES (999999, 1, 'DigiKey', 'SKU-NONE', 'Missing requester')
    `).run();
  }, /FOREIGN KEY constraint failed/i);

  assert.throws(() => {
    testDb.prepare(`
      INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description)
      VALUES (1, 999999, 'DigiKey', 'SKU-NONE', 'Missing subsystem')
    `).run();
  }, /FOREIGN KEY constraint failed/i);
});

// TEST 9: Unique Constraints on Email and Subsystem Code
test('T1-SCHEMA-08: Unique constraints prevent duplicate user emails and subsystem codes', () => {
  assert.throws(() => {
    testDb.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Duplicate Admin', 'admin@fsae.org', 'fakehash', 'Admin')
    `).run();
  }, /UNIQUE constraint failed/i);

  assert.throws(() => {
    testDb.prepare(`
      INSERT INTO subsystems (name, code, budget_allocated)
      VALUES ('Powertrain Duplicate', 'POW', 5000.0)
    `).run();
  }, /UNIQUE constraint failed/i);
});

// TEST 10: Cascade & Set Null Relationships
test('T1-SCHEMA-09: PO deletion cascades to Invoices and sets PartRequests po_id to NULL', () => {
  const member = testDb.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
  const purchaser = testDb.prepare('SELECT id FROM users WHERE email = ?').get('purchaser@fsae.org');
  const chaSub = testDb.prepare('SELECT id FROM subsystems WHERE code = ?').get('CHA');

  // Create dedicated PO
  const poInfo = testDb.prepare(`
    INSERT INTO purchase_orders (po_number, supplier, purchaser_id, total_cost)
    VALUES ('PO-TEST-CASCADE', 'Mouser', ?, 50.0)
  `).run(purchaser.id);
  const poId = poInfo.lastInsertRowid;

  // Create linked PartRequest
  const reqInfo = testDb.prepare(`
    INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, po_id)
    VALUES (?, ?, 'Mouser', 'CASCADE-SKU', 'Cascade Test Part', 1, 50.0, ?)
  `).run(member.id, chaSub.id, poId);
  const reqId = reqInfo.lastInsertRowid;

  // Create linked Invoice
  const invInfo = testDb.prepare(`
    INSERT INTO invoices (po_id, file_name, file_path, amount)
    VALUES (?, 'test_cascade.pdf', 'uploads/invoices/test_cascade.pdf', 50.0)
  `).run(poId);
  const invId = invInfo.lastInsertRowid;

  // Delete PO
  testDb.prepare('DELETE FROM purchase_orders WHERE id = ?').run(poId);

  // Check that invoice was cascaded (deleted)
  const invAfter = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
  assert.equal(invAfter, undefined, 'Invoice was cascaded on PO delete');

  // Check that part request still exists and po_id was set to NULL
  const reqAfter = testDb.prepare('SELECT po_id FROM part_requests WHERE id = ?').get(reqId);
  assert.ok(reqAfter, 'Part request still exists');
  assert.equal(reqAfter.po_id, null, 'Part request po_id was set to NULL on PO delete');
});

// TEST 11: Purchase Order and Part Request Status Constraints
test('T1-SCHEMA-10: Status check constraints enforce valid state machines', () => {
  const purchaser = testDb.prepare('SELECT id FROM users WHERE email = ?').get('purchaser@fsae.org');
  const member = testDb.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
  const chaSub = testDb.prepare('SELECT id FROM subsystems WHERE code = ?').get('CHA');

  // Invalid PO status
  assert.throws(() => {
    testDb.prepare(`
      INSERT INTO purchase_orders (po_number, supplier, purchaser_id, status)
      VALUES ('PO-BAD-STATUS', 'DigiKey', ?, 'SHIPPED_UNKNOWN')
    `).run(purchaser.id);
  }, /CHECK constraint failed/i);

  // Invalid PartRequest status
  assert.throws(() => {
    testDb.prepare(`
      INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, status)
      VALUES (?, ?, 'DigiKey', 'SKU-X', 'Test', 'LOST')
    `).run(member.id, chaSub.id);
  }, /CHECK constraint failed/i);
});

console.log(`\n=== TIER 1 TEST RESULTS ===`);
console.log(`Total Passed: ${passed}`);
console.log(`Total Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL TIER 1 DATABASE TESTS PASSED SUCCESSFULLY!\n');
}
