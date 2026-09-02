/**
 * Adversarial Challenger 2 Test Suite for Milestone 1 (Database & Security)
 * Focus Areas:
 *  1. Bcrypt Password Security (hashes, salt uniqueness, mismatch rejection, empty string handling)
 *  2. Seed Idempotency & Repeat Runs (consecutive runs, zero duplicate rows, foreign key integrity)
 *  3. Cascade & Referential Integrity (PO deletion cascades to multiple invoices, SET NULL on part requests, RESTRICT checks)
 */

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { initDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { runSeed } from '../db/seed.js';

console.log('\n================================================================');
console.log('🔥 CHALLENGER 2: ADVERSARIAL VERIFICATION & STRESS TEST HARNESS');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function adversarialTest(name, fn) {
  try {
    fn();
    console.log(`  🛡️  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  💥 FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    console.error(err.stack);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: BCRYPT HASHING & PASSWORD SECURITY STRESS TESTS
// -----------------------------------------------------------------------------
console.log('--- [SECTION 1] BCRYPT SECURITY & EDGE CASE TESTS ---');

adversarialTest('BCRYPT-01: Demo user password verification and bcrypt format structure', () => {
  const db = initDatabase(':memory:');
  runSeed(db);

  const demoUsers = [
    { email: 'member@fsae.org', pass: 'member123', role: 'Member' },
    { email: 'purchaser@fsae.org', pass: 'purchaser123', role: 'Purchaser' },
    { email: 'admin@fsae.org', pass: 'admin123', role: 'Admin' }
  ];

  for (const demo of demoUsers) {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(demo.email);
    assert.ok(user, `User ${demo.email} exists in DB`);
    assert.equal(user.role, demo.role, `Role matches ${demo.role}`);

    // Verify bcrypt hash structure ($2a$10$... or $2b$10$... and length 60)
    assert.ok(typeof user.password_hash === 'string', 'password_hash is string');
    assert.equal(user.password_hash.length, 60, 'Bcrypt hash length is exactly 60 characters');
    assert.match(user.password_hash, /^\$2[aby]\$10\$.{53}$/, 'Bcrypt format is standard modular crypt with cost 10');

    // Positive verification
    const match = bcrypt.compareSync(demo.pass, user.password_hash);
    assert.equal(match, true, `Password for ${demo.email} must match '${demo.pass}'`);
  }
});

adversarialTest('BCRYPT-02: Salt uniqueness & non-deterministic hashing across duplicate passwords', () => {
  const db = initDatabase(':memory:');
  runMigrations(db);

  const password = 'SharedPassword!2026';
  const hash1 = bcrypt.hashSync(password, 10);
  const hash2 = bcrypt.hashSync(password, 10);
  const hash3 = bcrypt.hashSync(password, 10);

  // Each hash must be completely unique due to random salt generation
  assert.notEqual(hash1, hash2, 'Hash 1 and Hash 2 must differ');
  assert.notEqual(hash2, hash3, 'Hash 2 and Hash 3 must differ');
  assert.notEqual(hash1, hash3, 'Hash 1 and Hash 3 must differ');

  // But all 3 must successfully verify the original password
  assert.ok(bcrypt.compareSync(password, hash1), 'Hash 1 verifies');
  assert.ok(bcrypt.compareSync(password, hash2), 'Hash 2 verifies');
  assert.ok(bcrypt.compareSync(password, hash3), 'Hash 3 verifies');

  // Verify demo users hashes in DB all have distinct salts
  runSeed(db);
  const hashes = db.prepare('SELECT password_hash FROM users').all().map(r => r.password_hash);
  const uniqueHashes = new Set(hashes);
  assert.equal(uniqueHashes.size, hashes.length, 'All seeded user password hashes are unique');
});

adversarialTest('BCRYPT-03: Brute-force & mutation mismatch rejection', () => {
  const db = initDatabase(':memory:');
  runSeed(db);

  const admin = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('admin@fsae.org');

  const adversarialAttempts = [
    'admin124',           // Off-by-one character
    'Admin123',           // Case variation
    'ADMIN123',           // All caps
    'admin 123',          // Injected space
    'admin123\0',         // Null byte suffix
    'admin123\n',         // Newline suffix
    ' admin123',          // Leading space
    'admin123 ',          // Trailing space
    'password',           // Common dictionary
    '123456',             // Common numeric
    "' OR '1'='1",        // SQL injection payload
    '<script>alert(1)</script>', // XSS payload
    'a'.repeat(72),       // Max bcrypt length
    'a'.repeat(100)       // Exceeding 72-byte truncation boundary
  ];

  for (const attempt of adversarialAttempts) {
    const isMatch = bcrypt.compareSync(attempt, admin.password_hash);
    assert.equal(isMatch, false, `Adversarial attempt '${attempt}' should NOT match admin hash`);
  }
});

adversarialTest('BCRYPT-04: Empty string, whitespace, and falsy input handling', () => {
  const db = initDatabase(':memory:');
  runSeed(db);

  const member = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('member@fsae.org');

  // Empty string does not match standard password
  assert.equal(bcrypt.compareSync('', member.password_hash), false, 'Empty string does not match');
  assert.equal(bcrypt.compareSync(' ', member.password_hash), false, 'Single whitespace does not match');
  assert.equal(bcrypt.compareSync('\t\n\r', member.password_hash), false, 'Whitespace chars do not match');

  // Hashing an empty string produces valid 60-char hash that only matches empty string
  const emptyHash = bcrypt.hashSync('', 10);
  assert.equal(emptyHash.length, 60, 'Empty password hash is 60 chars');
  assert.equal(bcrypt.compareSync('', emptyHash), true, 'Empty password verifies against empty hash');
  assert.equal(bcrypt.compareSync(' ', emptyHash), false, 'Space does not verify against empty hash');
  assert.equal(bcrypt.compareSync('a', emptyHash), false, 'Character does not verify against empty hash');
});


// -----------------------------------------------------------------------------
// SECTION 2: SEED IDEMPOTENCY & STRESS TESTS
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 2] SEED IDEMPOTENCY & REPEAT EXECUTION TESTS ---');

adversarialTest('SEED-01: Multi-run idempotency on fresh database (10 consecutive runs)', () => {
  const db = initDatabase(':memory:');

  for (let iteration = 1; iteration <= 10; iteration++) {
    const seedResult = runSeed(db);

    assert.equal(seedResult.usersCount, 3, `Iteration ${iteration}: Users count is 3`);
    assert.equal(seedResult.subsystemsCount, 6, `Iteration ${iteration}: Subsystems count is 6`);
    assert.equal(seedResult.purchaseOrdersCount, 2, `Iteration ${iteration}: Purchase Orders count is 2`);
    assert.equal(seedResult.partRequestsCount, 8, `Iteration ${iteration}: Part Requests count is 8`);
    assert.equal(seedResult.invoicesCount, 2, `Iteration ${iteration}: Invoices count is 2`);

    // Verify DB direct counts
    const dbUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const dbSubsystems = db.prepare('SELECT COUNT(*) as c FROM subsystems').get().c;
    const dbPOs = db.prepare('SELECT COUNT(*) as c FROM purchase_orders').get().c;
    const dbReqs = db.prepare('SELECT COUNT(*) as c FROM part_requests').get().c;
    const dbInvoices = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;

    assert.equal(dbUsers, 3, `DB Users count must remain 3 on run ${iteration}`);
    assert.equal(dbSubsystems, 6, `DB Subsystems count must remain 6 on run ${iteration}`);
    assert.equal(dbPOs, 2, `DB Purchase Orders count must remain 2 on run ${iteration}`);
    assert.equal(dbReqs, 8, `DB Part Requests count must remain 8 on run ${iteration}`);
    assert.equal(dbInvoices, 2, `DB Invoices count must remain 2 on run ${iteration}`);
  }
});

adversarialTest('SEED-02: Foreign Key integrity maintained across re-seeding', () => {
  const db = initDatabase(':memory:');
  
  // Seed first time
  runSeed(db);
  const po1Before = db.prepare("SELECT id FROM purchase_orders WHERE po_number = 'PO-2026-0001'").get();
  
  // Seed second time
  runSeed(db);
  const po1After = db.prepare("SELECT id FROM purchase_orders WHERE po_number = 'PO-2026-0001'").get();

  // PO ID should remain stable because of INSERT OR REPLACE with SELECT id
  assert.equal(po1Before.id, po1After.id, 'PO-2026-0001 ID remained stable across seed executions');

  // Verify all PartRequests with po_id reference existing POs
  const linkedReqs = db.prepare('SELECT * FROM part_requests WHERE po_id IS NOT NULL').all();
  assert.ok(linkedReqs.length > 0, 'There are linked part requests');
  for (const req of linkedReqs) {
    const parentPO = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.po_id);
    assert.ok(parentPO, `PartRequest ${req.id} references valid PO id ${req.po_id}`);
  }

  // Verify all Invoices reference valid POs
  const invoices = db.prepare('SELECT * FROM invoices').all();
  assert.equal(invoices.length, 2);
  for (const inv of invoices) {
    const parentPO = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(inv.po_id);
    assert.ok(parentPO, `Invoice ${inv.id} references valid PO id ${inv.po_id}`);
  }
});

adversarialTest('SEED-03: User passwords remain valid after multiple seed runs', () => {
  const db = initDatabase(':memory:');
  
  // Seed 5 times
  for (let i = 0; i < 5; i++) {
    runSeed(db);
  }

  const member = db.prepare('SELECT * FROM users WHERE email = ?').get('member@fsae.org');
  const purchaser = db.prepare('SELECT * FROM users WHERE email = ?').get('purchaser@fsae.org');
  const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@fsae.org');

  assert.ok(bcrypt.compareSync('member123', member.password_hash), 'Member password valid after 5 seed runs');
  assert.ok(bcrypt.compareSync('purchaser123', purchaser.password_hash), 'Purchaser password valid after 5 seed runs');
  assert.ok(bcrypt.compareSync('admin123', admin.password_hash), 'Admin password valid after 5 seed runs');
});


// -----------------------------------------------------------------------------
// SECTION 3: CASCADE DELETION & REFERENTIAL INTEGRITY STRESS TESTS
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 3] CASCADE DELETIONS & REFERENTIAL INTEGRITY TESTS ---');

adversarialTest('CASCADE-01: Deleting a PO with multiple Invoices and multiple PartRequests', () => {
  const db = initDatabase(':memory:');
  runSeed(db);

  const purchaser = db.prepare("SELECT id FROM users WHERE role = 'Purchaser'").get();
  const member = db.prepare("SELECT id FROM users WHERE role = 'Member'").get();
  const sub = db.prepare("SELECT id FROM subsystems WHERE code = 'POW'").get();

  // 1. Create a dedicated PO for stress testing
  const poInfo = db.prepare(`
    INSERT INTO purchase_orders (po_number, supplier, status, purchaser_id, total_cost)
    VALUES ('PO-STRESS-CASCADE-99', 'Mouser', 'ORDERED', ?, 1250.00)
  `).run(purchaser.id);
  const testPoId = poInfo.lastInsertRowid;

  // 2. Attach 5 Invoices to this PO
  const invoiceIds = [];
  for (let i = 1; i <= 5; i++) {
    const invInfo = db.prepare(`
      INSERT INTO invoices (po_id, file_name, file_path, amount)
      VALUES (?, ?, ?, ?)
    `).run(testPoId, `INV-STRESS-${i}.pdf`, `uploads/invoices/INV-STRESS-${i}.pdf`, 250.00);
    invoiceIds.push(invInfo.lastInsertRowid);
  }
  assert.equal(invoiceIds.length, 5, '5 test invoices created');

  // 3. Attach 6 PartRequests with varying urgencies to this PO
  const requestIds = [];
  const urgencies = ['NORMAL', 'URGENT', 'CRITICAL', 'NORMAL', 'URGENT', 'CRITICAL'];
  for (let i = 0; i < 6; i++) {
    const reqInfo = db.prepare(`
      INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, urgency_level, status, po_id)
      VALUES (?, ?, 'Mouser', ?, ?, 2, 125.00, ?, 'ORDERED', ?)
    `).run(member.id, sub.id, `SKU-CASCADE-${i}`, `Cascade Stress Item ${i}`, urgencies[i], testPoId);
    requestIds.push(reqInfo.lastInsertRowid);
  }
  assert.equal(requestIds.length, 6, '6 test part requests created');

  // Verify before deletion
  const preInvoices = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE po_id = ?').get(testPoId).c;
  assert.equal(preInvoices, 5, '5 invoices currently linked to PO');

  const preReqs = db.prepare('SELECT COUNT(*) as c FROM part_requests WHERE po_id = ?').get(testPoId).c;
  assert.equal(preReqs, 6, '6 part requests currently linked to PO');

  // 4. PERFORM ACTION: DELETE THE PURCHASE ORDER
  const delResult = db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(testPoId);
  assert.equal(delResult.changes, 1, '1 PO deleted');

  // 5. VERIFY CASCADE ON INVOICES: ALL 5 MUST BE PERMANENTLY REMOVED
  for (const invId of invoiceIds) {
    const invRow = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
    assert.equal(invRow, undefined, `Invoice ${invId} must be completely deleted (CASCADE)`);
  }
  const remainingInvoicesForPo = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE po_id = ?').get(testPoId).c;
  assert.equal(remainingInvoicesForPo, 0, 'Zero invoices remaining for deleted PO');

  // 6. VERIFY SET NULL ON PART REQUESTS: ALL 6 MUST STILL EXIST WITH po_id = NULL
  for (const reqId of requestIds) {
    const reqRow = db.prepare('SELECT * FROM part_requests WHERE id = ?').get(reqId);
    assert.ok(reqRow, `PartRequest ${reqId} must still exist in DB`);
    assert.equal(reqRow.po_id, null, `PartRequest ${reqId} po_id must be updated to NULL`);
    assert.equal(reqRow.status, 'ORDERED', `PartRequest ${reqId} other attributes remain intact`);
  }
  const nullPoReqs = db.prepare('SELECT COUNT(*) as c FROM part_requests WHERE id IN (?,?,?,?,?,?) AND po_id IS NULL')
    .get(...requestIds).c;
  assert.equal(nullPoReqs, 6, 'All 6 part requests now have NULL po_id');
});

adversarialTest('CASCADE-02: ON DELETE RESTRICT protects Users with active Purchase Orders and Requests', () => {
  const db = initDatabase(':memory:');
  runSeed(db);

  const purchaser = db.prepare("SELECT id FROM users WHERE email = 'purchaser@fsae.org'").get();
  const member = db.prepare("SELECT id FROM users WHERE email = 'member@fsae.org'").get();

  // Attempting to delete purchaser who is referenced by purchase_orders must fail
  assert.throws(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(purchaser.id);
  }, /FOREIGN KEY constraint failed/i, 'Deleting purchaser with active POs blocked by RESTRICT');

  // Attempting to delete member who is referenced by part_requests must fail
  assert.throws(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(member.id);
  }, /FOREIGN KEY constraint failed/i, 'Deleting requester with active requests blocked by RESTRICT');
});

adversarialTest('CASCADE-03: ON DELETE RESTRICT protects Subsystems with active Part Requests', () => {
  const db = initDatabase(':memory:');
  runSeed(db);

  const powSub = db.prepare("SELECT id FROM subsystems WHERE code = 'POW'").get();

  // Attempting to delete subsystem referenced by part_requests must fail
  assert.throws(() => {
    db.prepare('DELETE FROM subsystems WHERE id = ?').run(powSub.id);
  }, /FOREIGN KEY constraint failed/i, 'Deleting subsystem with active part requests blocked by RESTRICT');
});

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`🏁 CHALLENGER 2 ADVERSARIAL TEST SUMMARY`);
console.log(`Total Passed: ${passed}`);
console.log(`Total Failed: ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
  console.error('💥 ADVERSARIAL STRESS TESTS DETECTED FAILURES!');
  process.exit(1);
} else {
  console.log('🛡️  ALL ADVERSARIAL TESTS PASSED CONVINCINGLY! NO REGRESSIONS FOUND.\n');
  if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    process.exit(0);
  }
}
