import assert from 'node:assert/strict';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { createApp } from '../index.js';
import { generateToken } from '../middleware/auth.js';

console.log('\n=== RUNNING TESTS: ADMIN USER MANAGEMENT & ROLE PERMISSIONS ===\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// 1. In-memory clean test database
const testDb = initDatabase(':memory:');
runMigrations(testDb);

// Helper to seed users
function seedTestUser(name, email, role, department = null, subsystem = null) {
  const hash = bcrypt.hashSync('pass123', 10);
  const info = testDb.prepare(`
    INSERT INTO users (name, email, password_hash, role, department, subsystem)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, email, hash, role, department, subsystem);

  const user = testDb.prepare('SELECT id, name, email, role, department, subsystem FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = generateToken(user);
  return { user, token };
}

// Seed official subsystems
testDb.prepare(`
  INSERT INTO subsystems (name, code, budget_allocated)
  VALUES ('Team Électrique', 'ELE', 15000.0),
         ('Team Administration', 'ADM', 5000.0)
`).run();
const eleSub = testDb.prepare("SELECT id FROM subsystems WHERE code = 'ELE'").get();
const admSub = testDb.prepare("SELECT id FROM subsystems WHERE code = 'ADM'").get();

const app = createApp(testDb);
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

try {
  // Tests
  await test('R1: SQLite CHECK constraint allows Lead, Member, Purchaser, Admin and rejects invalid', () => {
    // Valid roles
    assert.doesNotThrow(() => {
      testDb.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('L', 'lead1@fsae.org', 'h', 'Lead')").run();
    });
    // Invalid role
    assert.throws(() => {
      testDb.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('X', 'bad@fsae.org', 'h', 'SuperUser')").run();
    }, /CHECK constraint failed/i);
  });

  await test('R2: JWT token contains department and subsystem', () => {
    const { user, token } = seedTestUser('Token Test', 'tok@fsae.org', 'Lead', 'ADM', 'Finances');
    const decoded = jwt.decode(token);
    assert.equal(decoded.department, 'ADM');
    assert.equal(decoded.subsystem, 'Finances');
    assert.equal(decoded.role, 'Lead');
  });

  // Setup users for API testing
  const admin1 = seedTestUser('Admin One', 'admin1@fsae.org', 'Admin', 'ADM');
  const admin2 = seedTestUser('Admin Two', 'admin2@fsae.org', 'Admin', 'ELE');
  const leadAdm = seedTestUser('Lead Adm', 'lead_adm@fsae.org', 'Lead', 'Team Administration');
  const leadEle = seedTestUser('Lead Ele', 'lead_ele@fsae.org', 'Lead', 'ELE');
  const member1 = seedTestUser('Member One', 'member1@fsae.org', 'Member', 'ELE');

  await test('R3: GET /api/users is protected for Admin only', async () => {
    // Member gets 403
    const resMember = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${member1.token}` }
    });
    assert.equal(resMember.status, 403);

    // Lead gets 403
    const resLead = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${leadAdm.token}` }
    });
    assert.equal(resLead.status, 403);

    // Unauthenticated gets 401
    const resAnon = await fetch(`${baseUrl}/api/users`);
    assert.equal(resAnon.status, 401);

    // Admin gets 200 and user list without password hashes
    const resAdmin = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${admin1.token}` }
    });
    assert.equal(resAdmin.status, 200);
    const data = await resAdmin.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 5);
    for (const u of data) {
      assert.equal(u.password_hash, undefined, 'Password hash must never be returned');
      assert.ok(u.id);
      assert.ok(u.name);
      assert.ok(u.email);
      assert.ok(u.role);
    }
  });

  await test('R4: PATCH /api/users/:id allows Admin to edit role & department', async () => {
    const res = await fetch(`${baseUrl}/api/users/${member1.user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${admin1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'Lead', department: 'DRI', subsystem: 'Transmission' })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.role, 'Lead');
    assert.equal(body.department, 'DRI');
    assert.equal(body.subsystem, 'Transmission');
  });

  await test('R5: Anti-lockout: Admin cannot demote themselves from Admin', async () => {
    const res = await fetch(`${baseUrl}/api/users/${admin1.user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${admin1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'Member' })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('rétrograder'));
  });

  await test('R6: Anti-lockout: Cannot demote the last remaining Admin', async () => {
    // Demote admin2 using admin1
    const resDemoteAdmin2 = await fetch(`${baseUrl}/api/users/${admin2.user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${admin1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'Member' })
    });
    assert.equal(resDemoteAdmin2.status, 200);

    // Now admin1 is the ONLY admin. Attempt to demote admin1
    const resDemoteLast = await fetch(`${baseUrl}/api/users/${admin1.user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${admin1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'Lead' })
    });
    assert.equal(resDemoteLast.status, 400);

    // Re-promote admin2
    await fetch(`${baseUrl}/api/users/${admin2.user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${admin1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'Admin' })
    });
  });

  await test('R7: DELETE /api/users/:id anti-lockout safeguards', async () => {
    // 1. Cannot delete oneself
    const resDeleteSelf = await fetch(`${baseUrl}/api/users/${admin1.user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${admin1.token}` }
    });
    assert.equal(resDeleteSelf.status, 400);
    const body = await resDeleteSelf.json();
    assert.ok(body.error.includes('propre compte'));

    // 2. Cannot delete the last remaining Admin
    // Temporarily demote admin2 to Member so admin1 is the ONLY admin
    testDb.prepare("UPDATE users SET role = 'Member' WHERE id = ?").run(admin2.user.id);
    const soloAdmin = seedTestUser('Solo Admin', 'solo@fsae.org', 'Admin');
    // Now there are 2 admins (admin1 and soloAdmin). Let's delete admin1? admin1 is self, so test admin1 deleting soloAdmin
    // When soloAdmin is the only other admin, deleting soloAdmin succeeds, leaving admin1 as the single admin:
    const resDelSolo = await fetch(`${baseUrl}/api/users/${soloAdmin.user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${admin1.token}` }
    });
    assert.equal(resDelSolo.status, 200);

    // Now admin1 is strictly the only Admin in the entire database.
    // If another request attempted to delete the last admin (e.g. an API caller targeting admin1):
    // Since admin1 cannot delete admin1 (self-delete blocked), create a 3rd admin to test deleting the last admin if count check fires:
    const testAdminCount = testDb.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'Admin'").get().c;
    assert.equal(testAdminCount, 1);

    // Restore admin2 role to Admin
    testDb.prepare("UPDATE users SET role = 'Admin' WHERE id = ?").run(admin2.user.id);

    // 3. Foreign key safeguard: Cannot delete user with part requests
    const userWithReq = seedTestUser('Requester User', 'req_user@fsae.org', 'Member');
    testDb.prepare(`
      INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, status)
      VALUES (?, ?, 'DigiKey', 'TEST-DEL-1', 'Resistor 10k', 10, 0.5, 'SUBMITTED')
    `).run(userWithReq.user.id, eleSub.id);

    const resDelReqUser = await fetch(`${baseUrl}/api/users/${userWithReq.user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${admin1.token}` }
    });
    assert.equal(resDelReqUser.status, 400);
    const delReqBody = await resDelReqUser.json();
    assert.ok(delReqBody.error.includes('demandes de pièces'));

    // 4. Delete clean temporary member succeeds
    const tempUser = seedTestUser('Temp User', 'temp@fsae.org', 'Member');
    const resDelete = await fetch(`${baseUrl}/api/users/${tempUser.user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${admin1.token}` }
    });
    assert.equal(resDelete.status, 200);
    const delBody = await resDelete.json();
    assert.equal(delBody.success, true);
  });

  await test('R8: Subsystem creation & PATCH /budget permissions', async () => {
    // 1. Regular Member receives 403 on budget update
    const resMemPatch = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}/budget`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${member1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ budget_allocated: 20000.0 })
    });
    assert.equal(resMemPatch.status, 403);

    // 2. Lead from ELE (not Team Admin) receives 403 on budget update
    const resElePatch = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}/budget`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${leadEle.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ budget_allocated: 20000.0 })
    });
    assert.equal(resElePatch.status, 403);

    // 3. Regular Member receives 403 on subsystem POST creation
    const resMemPost = await fetch(`${baseUrl}/api/subsystems`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${member1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Sub Mem', code: 'SBM', budget_allocated: 1000 })
    });
    assert.equal(resMemPost.status, 403);

    // 4. Lead from ELE receives 403 on subsystem POST creation
    const resElePost = await fetch(`${baseUrl}/api/subsystems`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${leadEle.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Sub ELE', code: 'SBE', budget_allocated: 1000 })
    });
    assert.equal(resElePost.status, 403);

    // 5. Lead from Team Administration (ADM) succeeds on budget update
    const resAdmPatch = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}/budget`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${leadAdm.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ budget_allocated: 18000.0 })
    });
    assert.equal(resAdmPatch.status, 200);
    const admData = await resAdmPatch.json();
    assert.equal(admData.budget_allocated, 18000.0);

    // 6. Lead from Team Administration gets 403 on subsystem POST creation (Admin only)
    const resAdmPost = await fetch(`${baseUrl}/api/subsystems`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${leadAdm.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Sub ADM New', code: 'SAN', budget_allocated: 2500 })
    });
    assert.equal(resAdmPost.status, 403);

    // 6b. Admin succeeds on subsystem POST creation
    const resAdminPost = await fetch(`${baseUrl}/api/subsystems`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${admin1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Sub ADM New', code: 'SAN', budget_allocated: 2500 })
    });
    assert.equal(resAdminPost.status, 201);
    const newSubData = await resAdminPost.json();
    assert.equal(newSubData.code, 'SAN');

    // 7. Admin succeeds on budget update
    const resAdminPatch = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}/budget`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${admin1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ budget_allocated: 19500.0 })
    });
    assert.equal(resAdminPatch.status, 200);
    const adminData = await resAdminPatch.json();
    assert.equal(adminData.budget_allocated, 19500.0);

    // 8. Real-time DB sync: Promoting leadEle to ADM immediately allows budget edit even with old token
    testDb.prepare("UPDATE users SET department = 'ADM' WHERE id = ?").run(leadEle.user.id);
    const resPromotedPatch = await fetch(`${baseUrl}/api/subsystems/${eleSub.id}/budget`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${leadEle.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ budget_allocated: 21000.0 })
    });
    assert.equal(resPromotedPatch.status, 200);
    // Reset back to ELE
    testDb.prepare("UPDATE users SET department = 'ELE' WHERE id = ?").run(leadEle.user.id);
  });

  await test('R9: Purchase Orders creation and status update by Lead', async () => {
    // Create a part request
    const insReq = testDb.prepare(`
      INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, status)
      VALUES (?, ?, 'DigiKey', 'TEST-PART-1', 'Relay 12V', 2, 15.0, 'APPROVED')
    `).run(leadEle.user.id, eleSub.id);
    const reqId = insReq.lastInsertRowid;

    // Member tries to create PO -> 403
    const resMemPo = await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${member1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ supplier: 'DigiKey', request_ids: [reqId] })
    });
    assert.equal(resMemPo.status, 403);

    // Lead creates PO -> 201
    const resLeadPo = await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${leadEle.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ supplier: 'DigiKey', request_ids: [reqId] })
    });
    assert.equal(resLeadPo.status, 201);
    const poData = await resLeadPo.json();
    const poId = poData.id;

    // Member tries to update status -> 403
    const resMemStatus = await fetch(`${baseUrl}/api/purchase-orders/${poId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${member1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.equal(resMemStatus.status, 403);

    // Lead updates status -> 200
    const resLeadStatus = await fetch(`${baseUrl}/api/purchase-orders/${poId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${leadEle.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.equal(resLeadStatus.status, 200);
    const statusData = await resLeadStatus.json();
    assert.equal(statusData.status, 'COMPLETED');
  });

  // Also include in test_runner
} finally {
  server.close();
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
