/**
 * Verification Test Suite for Subsystems & Budgets Management:
 * 1. Public Subsystems List (GET /api/subsystems/public-list) without auth
 * 2. RBAC & Updating Subsystems (PATCH /api/subsystems/:id) - Admin allowed, Member/Purchaser 403
 * 3. Subsystem Deletion (DELETE /api/subsystems/:id) - Admin allowed when no references, 400 when referenced
 * 4. Seed Idempotency & Budget Non-Destruction (Preservation of custom budgets)
 * 5. PartRequestModal Subsystem Preselection Logic
 */
import assert from 'assert';
import Database from 'better-sqlite3';
import express from 'express';
import http from 'http';

import { runMigrations } from '../db/migrate.js';
import { seedSubsystems, runDemoSeed, runProdSeed } from '../db/seed.js';
import { createAuthRouter } from '../routes/auth.routes.js';
import { createSubsystemsRouter } from '../routes/subsystems.routes.js';
import { createRequestsRouter } from '../routes/requests.routes.js';
import { resolveDefaultSubsystemId } from '../../src/utils/subsystemHelper.js';

console.log('====================================================');
console.log('🏛️  SUBSYSTEMS & BUDGET MANAGEMENT TEST SUITE');
console.log('====================================================\n');

async function runSubsystemsTests() {
  const testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  runMigrations(testDb);

  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(testDb));
  app.use('/api/subsystems', createSubsystemsRouter(testDb));
  app.use('/api/part-requests', createRequestsRouter(testDb));

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Setup users (Admin, Purchaser, Member)
    // -------------------------------------------------------------------------
    // First user is Admin
    const adminRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Chief Engineer',
        email: 'admin@fsae.uqtr.ca',
        password: 'password123',
        department: 'ADM'
      })
    });
    const adminData = await adminRes.json();
    const adminToken = adminData.token;

    // Purchaser user
    testDb.prepare(`
      INSERT INTO users (name, email, password_hash, role, department)
      VALUES ('Purchaser Bob', 'purchaser@fsae.uqtr.ca', 'dummyhash', 'Purchaser', 'ADM')
    `).run();
    const purchaserId = testDb.prepare('SELECT id FROM users WHERE email = ?').get('purchaser@fsae.uqtr.ca').id;
    // Generate valid token for purchaser via auth route login or direct token
    // We can set password hash with bcrypt to test login
    import('bcryptjs').then(b => {
      const hash = b.default.hashSync('password123', 10);
      testDb.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, purchaserId);
    });
    const purchaserLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'purchaser@fsae.uqtr.ca', password: 'password123' })
    });
    const purchaserData = await purchaserLoginRes.json();
    const purchaserToken = purchaserData.token;

    // Member user
    const memberRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Electric Member',
        email: 'member@fsae.uqtr.ca',
        password: 'password123',
        department: 'ELE',
        subsystem: 'BMS'
      })
    });
    const memberData = await memberRes.json();
    const memberToken = memberData.token;

    // Seed official subsystems into testDb
    seedSubsystems(testDb);

    console.log('--- [1. Public Subsystems List: GET /api/subsystems/public-list] ---');

    await test('GET /api/subsystems/public-list returns 200 without authentication', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/public-list`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data));
      assert.ok(data.length >= 5);
      const ele = data.find(s => s.code === 'ELE');
      assert.ok(ele);
      assert.strictEqual(ele.name, 'Team Électrique');
      assert.strictEqual(typeof ele.id, 'number');
      // Public list should not expose detailed financial allocations
      assert.strictEqual(ele.budget_allocated, undefined);
    });

    console.log('\n--- [2. Subsystems RBAC & Budget Updates: PATCH /api/subsystems/:id] ---');

    const eleSub = testDb.prepare('SELECT id, budget_allocated FROM subsystems WHERE code = ?').get('ELE');

    await test('PATCH /api/subsystems/:id returns 401 if unauthenticated', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_allocated: 20000.0 })
      });
      assert.strictEqual(res.status, 401);
    });

    await test('PATCH /api/subsystems/:id returns 403 for Member role', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`
        },
        body: JSON.stringify({ budget_allocated: 20000.0 })
      });
      assert.strictEqual(res.status, 403);
    });

    await test('PATCH /api/subsystems/:id returns 403 for Purchaser role', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${purchaserToken}`
        },
        body: JSON.stringify({ budget_allocated: 20000.0 })
      });
      assert.strictEqual(res.status, 403);
    });

    await test('PATCH /api/subsystems/:id validates budget_allocated >= 0', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ budget_allocated: -100 })
      });
      assert.strictEqual(res.status, 400);
      const err = await res.json();
      assert.ok(err.error.includes('non-negative'));
    });

    await test('PATCH /api/subsystems/:id rejects non-finite budget (Infinity, NaN)', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ budget_allocated: 'Infinity' })
      });
      assert.strictEqual(res.status, 400);
      const err = await res.json();
      assert.ok(err.error.includes('non-negative'));
    });

    await test('PATCH /api/subsystems/:id allows Admin to update budget_allocated', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ budget_allocated: 18500.50 })
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.id, eleSub.id);
      assert.strictEqual(updated.budget_allocated, 18500.50);

      // Verify reflected in GET /api/subsystems aggregation
      const listRes = await fetch(`${baseUrl}/api/subsystems`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const list = await listRes.json();
      const updatedInList = list.find(s => s.id === eleSub.id);
      assert.strictEqual(updatedInList.budget_allocated, 18500.50);
    });

    await test('GET /api/subsystems allows Member role to retrieve all financial aggregations', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems`, {
        headers: { Authorization: `Bearer ${memberToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data));
      assert.ok(data.length >= 5);
      const ele = data.find(s => s.code === 'ELE');
      assert.ok(ele);
      assert.strictEqual(typeof ele.budget_allocated, 'number');
      assert.strictEqual(typeof ele.committed_cost, 'number');
      assert.strictEqual(typeof ele.actual_cost, 'number');
      assert.strictEqual(typeof ele.remaining_budget, 'number');
      assert.strictEqual(typeof ele.pct_used, 'number');
      assert.ok(!isNaN(ele.remaining_budget));
      assert.ok(!isNaN(ele.pct_used));
    });

    await test('PATCH /api/subsystems/:id allows Admin to update name and code with uniqueness check', async () => {
      // Create temporary subsystem
      const createRes = await fetch(`${baseUrl}/api/subsystems`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name: 'Team Aero', code: 'AER', budget_allocated: 3000 })
      });
      assert.strictEqual(createRes.status, 201);
      const created = await createRes.json();

      // Test duplicate code conflict
      const dupRes = await fetch(`${baseUrl}/api/subsystems/${created.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ code: 'ELE' })
      });
      assert.strictEqual(dupRes.status, 409);

      // Test valid update
      const updateRes = await fetch(`${baseUrl}/api/subsystems/${created.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name: 'Team Aerodynamics & Cooling', code: 'AERO' })
      });
      assert.strictEqual(updateRes.status, 200);
      const patched = await updateRes.json();
      assert.strictEqual(patched.name, 'Team Aerodynamics & Cooling');
      assert.strictEqual(patched.code, 'AERO');
    });

    console.log('\n--- [3. Subsystem Deletion: DELETE /api/subsystems/:id] ---');

    await test('DELETE /api/subsystems/:id returns 401 if unauthenticated', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'DELETE'
      });
      assert.strictEqual(res.status, 401);
    });

    await test('DELETE /api/subsystems/:id returns 403 for Member role', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${memberToken}` }
      });
      assert.strictEqual(res.status, 403);
    });

    await test('DELETE /api/subsystems/:id returns 403 for Purchaser role', async () => {
      const res = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${purchaserToken}` }
      });
      assert.strictEqual(res.status, 403);
    });

    await test('DELETE /api/subsystems/:id prevents deleting subsystem with active part_requests', async () => {
      // Create a part request under eleSub
      const prRes = await fetch(`${baseUrl}/api/part-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`
        },
        body: JSON.stringify({
          subsystem_id: eleSub.id,
          supplier: 'DigiKey',
          sku: 'BMS-1234',
          description: 'Cell Monitoring IC',
          quantity: 2,
          unit_price_est: 15.0
        })
      });
      assert.strictEqual(prRes.status, 201);

      // Attempt to delete eleSub
      const delRes = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(delRes.status, 400);
      const delErr = await delRes.json();
      assert.ok(delErr.error.includes('Impossible de supprimer le sous-système'));
    });

    await test('DELETE /api/subsystems/:id deletes unreferenced subsystem successfully', async () => {
      // Find the AERO subsystem created above
      const aero = testDb.prepare('SELECT id FROM subsystems WHERE code = ?').get('AERO');
      assert.ok(aero);

      const delRes = await fetch(`${baseUrl}/api/subsystems/${aero.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(delRes.status, 200);

      const check = testDb.prepare('SELECT id FROM subsystems WHERE id = ?').get(aero.id);
      assert.strictEqual(check, undefined);
    });

    console.log('\n--- [4. Seed Non-Destruction: Custom Budgets Preservation] ---');

    await test('Seed re-run preserves custom budget adjustments made by Admins', async () => {
      // Custom budget was set to 18500.50 on ELE
      const beforeSeed = testDb.prepare('SELECT budget_allocated FROM subsystems WHERE code = ?').get('ELE');
      assert.strictEqual(beforeSeed.budget_allocated, 18500.50);

      // Re-run seedSubsystems
      seedSubsystems(testDb);

      const afterSeed = testDb.prepare('SELECT budget_allocated FROM subsystems WHERE code = ?').get('ELE');
      assert.strictEqual(
        afterSeed.budget_allocated,
        18500.50,
        'Custom budget must NOT be overwritten by seed re-runs!'
      );
    });

    console.log('\n--- [5. PartRequestModal Subsystem Resolution Logic] ---');

    await test('Default subsystem resolution matches user department or defaults to first', () => {
      const sampleSubs = [
        { id: 10, code: 'ELE', name: 'Team Électrique' },
        { id: 20, code: 'STR', name: 'Team Structure' },
        { id: 30, code: 'DRI', name: 'Team Drivetrain' },
        { id: 40, code: 'ERG', name: 'Team Ergonomique' },
        { id: 50, code: 'ADM', name: 'Team Admin' }
      ];

      // Case 1: user with direct code 'STR'
      assert.strictEqual(resolveDefaultSubsystemId(sampleSubs, { department: 'STR' }), 20);

      // Case 2: user with direct code in subsystem field
      assert.strictEqual(resolveDefaultSubsystemId(sampleSubs, { subsystem: 'DRI' }), 30);

      // Case 3: user with accented name 'Électrique'
      assert.strictEqual(resolveDefaultSubsystemId(sampleSubs, { department: 'Électrique' }), 10);

      // Case 4: user with unaccented name 'Electrique' (resilience to diacritics)
      assert.strictEqual(resolveDefaultSubsystemId(sampleSubs, { department: 'Electrique' }), 10);

      // Case 5: user with full name 'Team Structure'
      assert.strictEqual(resolveDefaultSubsystemId(sampleSubs, { department: 'Team Structure' }), 20);

      // Case 6: bidirectional name match (user 'Team Administration' vs system 'Team Admin')
      assert.strictEqual(resolveDefaultSubsystemId(sampleSubs, { department: 'Team Administration' }), 50);

      // Case 7: specialty keyword heuristic (user with 'BMS & Accu' maps to ELE)
      assert.strictEqual(resolveDefaultSubsystemId(sampleSubs, { department: '', subsystem: 'BMS & Accu' }), 10);

      // Case 8: user with unknown department defaults to first subsystem (id 10)
      assert.strictEqual(resolveDefaultSubsystemId(sampleSubs, { department: 'UNKNOWN' }), 10);

      // Case 9: user is null defaults to first subsystem (id 10)
      assert.strictEqual(resolveDefaultSubsystemId(sampleSubs, null), 10);

      // Case 10: empty list returns empty string
      assert.strictEqual(resolveDefaultSubsystemId([], { department: 'ELE' }), '');
    });

    console.log('====================================================');
    console.log(`🏆 ALL ${passed} SUBSYSTEMS & BUDGET MANAGEMENT TESTS PASSED!`);
    console.log('====================================================\n');
  } finally {
    server.close();
    testDb.close();
  }
}

runSubsystemsTests().catch(err => {
  console.error('Fatal error running subsystems tests:', err);
  process.exit(1);
});
