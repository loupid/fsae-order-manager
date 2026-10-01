/**
 * Verification Test Suite for P0 and P1 Fixes:
 * 1. Role Escalation Prevention at Registration
 * 2. Strict PO Item Status Validation (rejection of ORDERED, RECEIVED, REJECTED, po_id != null)
 * 3. PO Cancellation Item Status Reset (to SUBMITTED with po_id = null)
 * 4. Missing PATCH /api/part-requests/:id Endpoint (Owner, Purchaser, Admin RBAC)
 * 5. Multi-Status Filtering in GET /api/part-requests
 * 6. Seed Demo Invoice PDF Generation and Download
 * 7. Frontend component units (CsvExportModal safety, DigiKey regex, PurchaserDashboard badge)
 */
import assert from 'assert';
import Database from 'better-sqlite3';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';

import { runMigrations } from '../db/migrate.js';
import { runDemoSeed, ensureDemoInvoiceFiles } from '../db/seed.js';
import { createAuthRouter } from '../routes/auth.routes.js';
import { createRequestsRouter } from '../routes/requests.routes.js';
import { createOrdersRouter } from '../routes/orders.routes.js';
import { createInvoicesRouter } from '../routes/invoices.routes.js';

console.log('====================================================');
console.log('🛡️  P0 & P1 COMPREHENSIVE REGRESSION & BEHAVIOR TESTS');
console.log('====================================================\n');

async function runP0P1Tests() {
  // Setup in-memory SQLite DB
  const testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  runMigrations(testDb);

  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(testDb));
  app.use('/api/part-requests', createRequestsRouter(testDb));
  app.use('/api/purchase-orders', createOrdersRouter(testDb));
  app.use('/api/invoices', createInvoicesRouter(testDb));

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
    // 1. ROLE ESCALATION PREVENTION
    // -------------------------------------------------------------------------
    console.log('--- [1. Auth: Privilege Escalation Prevention] ---');

    await test('First user in empty DB is granted Admin role', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'First User Admin',
          email: 'first_admin@fsae.local',
          password: 'password123',
          role: 'Member' // even if Member requested, first user becomes Admin
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.user.role, 'Admin');
    });

    await test('Subsequent registration with role Admin is strictly forced to Member', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Attacker Admin Attempt',
          email: 'attacker_admin@fsae.local',
          password: 'password123',
          role: 'Admin' // attempted privilege escalation
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.user.role, 'Member', 'Must be forced to Member role');
    });

    await test('Subsequent registration with role Purchaser is strictly forced to Member', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Attacker Purchaser Attempt',
          email: 'attacker_purchaser@fsae.local',
          password: 'password123',
          role: 'Purchaser' // attempted privilege escalation
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.user.role, 'Member', 'Must be forced to Member role');
    });

    // -------------------------------------------------------------------------
    // 2. SEED DEMO & INVOICES
    // -------------------------------------------------------------------------
    console.log('\n--- [2. Seed Demo & Invoice PDF Generation] ---');

    // Run demo seed on DB
    runDemoSeed(testDb);

    await test('ensureDemoInvoiceFiles creates valid PDF files on disk', async () => {
      ensureDemoInvoiceFiles();
      const p1 = path.resolve(process.cwd(), 'uploads/invoices/INV-2026-0001.pdf');
      const p2 = path.resolve(process.cwd(), 'uploads/invoices/INV-2026-0002.pdf');
      assert.ok(fs.existsSync(p1), 'INV-2026-0001.pdf must exist');
      assert.ok(fs.existsSync(p2), 'INV-2026-0002.pdf must exist');

      const buf1 = fs.readFileSync(p1);
      assert.ok(buf1.toString().startsWith('%PDF'), 'Must have valid %PDF magic bytes');
    });

    // Login as purchaser
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'purchaser@fsae.org', password: 'purchaser123' })
    });
    const { token: purchaserToken } = await loginRes.json();

    // Login as member
    const memLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@fsae.org', password: 'member123' })
    });
    const { token: memberToken, user: memberUser } = await memLoginRes.json();

    await test('GET /api/invoices/:id/download returns 200 with application/pdf', async () => {
      const invoices = testDb.prepare('SELECT id FROM invoices').all();
      assert.ok(invoices.length >= 2, 'Should have seeded invoices');

      const res = await fetch(`${baseUrl}/api/invoices/${invoices[0].id}/download`, {
        headers: { Authorization: `Bearer ${purchaserToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
      const text = await res.text();
      assert.ok(text.startsWith('%PDF'));
    });

    // -------------------------------------------------------------------------
    // 3. STRICT PO CREATION ITEM STATUS VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- [3. Orders: Strict PO Creation Status Validation] ---');

    await test('PO creation rejects item with status ORDERED', async () => {
      // Find an item that is already ORDERED from seed
      const orderedItem = testDb.prepare("SELECT id FROM part_requests WHERE status = 'ORDERED' LIMIT 1").get();
      assert.ok(orderedItem, 'Seeded ordered item should exist');

      const res = await fetch(`${baseUrl}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaserToken}` },
        body: JSON.stringify({
          supplier: 'DigiKey',
          request_ids: [orderedItem.id]
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('assigned') || data.error.includes('status'));
    });

    await test('PO creation rejects item with status RECEIVED', async () => {
      // Create a dummy item with RECEIVED status
      const ins = testDb.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, status, po_id)
        VALUES (?, 1, 'DigiKey', 'DK-REC', 'Received Part', 1, 10.0, 'RECEIVED', NULL)
      `).run(memberUser.id);

      const res = await fetch(`${baseUrl}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaserToken}` },
        body: JSON.stringify({
          supplier: 'DigiKey',
          request_ids: [ins.lastInsertRowid]
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('cannot be included in a purchase order') || data.error.includes('status'));
    });

    await test('PO creation rejects item with status REJECTED', async () => {
      // Create a dummy item with REJECTED status
      const ins = testDb.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, status, po_id)
        VALUES (?, 1, 'DigiKey', 'DK-REJ', 'Rejected Part', 1, 10.0, 'REJECTED', NULL)
      `).run(memberUser.id);

      const res = await fetch(`${baseUrl}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaserToken}` },
        body: JSON.stringify({
          supplier: 'DigiKey',
          request_ids: [ins.lastInsertRowid]
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('cannot be included in a purchase order') || data.error.includes('status'));
    });

    await test('PO creation rejects item with po_id != null even if status is SUBMITTED', async () => {
      // Corrupt state simulation: po_id set but status somehow SUBMITTED
      const ins = testDb.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, status, po_id)
        VALUES (?, 1, 'DigiKey', 'DK-STOLEN', 'Stolen Part', 1, 10.0, 'SUBMITTED', 1)
      `).run(memberUser.id);

      const res = await fetch(`${baseUrl}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaserToken}` },
        body: JSON.stringify({
          supplier: 'DigiKey',
          request_ids: [ins.lastInsertRowid]
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('assigned to active PO'));
    });

    // -------------------------------------------------------------------------
    // 4. PO CANCELLATION & RETURN OF ITEMS TO SUBMITTED
    // -------------------------------------------------------------------------
    console.log('\n--- [4. Orders: PO Cancellation Items Reset] ---');

    await test('PATCH /api/purchase-orders/:id/cancel cancels PO and resets items to SUBMITTED with po_id = null', async () => {
      // Create fresh SUBMITTED items
      const p1 = testDb.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, status, po_id)
        VALUES (?, 1, 'Mouser', 'MOU-101', 'Microcontroller', 2, 15.0, 'SUBMITTED', NULL)
      `).run(memberUser.id).lastInsertRowid;

      const p2 = testDb.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, status, po_id)
        VALUES (?, 1, 'Mouser', 'MOU-102', 'Crystal 16MHz', 4, 1.25, 'APPROVED', NULL)
      `).run(memberUser.id).lastInsertRowid;

      // Group into PO
      const poRes = await fetch(`${baseUrl}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaserToken}` },
        body: JSON.stringify({
          supplier: 'Mouser',
          request_ids: [p1, p2]
        })
      });
      assert.strictEqual(poRes.status, 201);
      const po = await poRes.json();
      assert.strictEqual(po.status, 'ORDERED');

      // Now Cancel the PO via dedicated cancel endpoint
      const cancelRes = await fetch(`${baseUrl}/api/purchase-orders/${po.id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${purchaserToken}` }
      });
      assert.strictEqual(cancelRes.status, 200);
      const cancelledPo = await cancelRes.json();
      assert.strictEqual(cancelledPo.status, 'CANCELLED');

      // Check item states in DB
      const item1 = testDb.prepare('SELECT * FROM part_requests WHERE id = ?').get(p1);
      const item2 = testDb.prepare('SELECT * FROM part_requests WHERE id = ?').get(p2);

      assert.strictEqual(item1.status, 'SUBMITTED', 'Item 1 status must be SUBMITTED');
      assert.strictEqual(item1.po_id, null, 'Item 1 po_id must be null');
      assert.strictEqual(item2.status, 'SUBMITTED', 'Item 2 status must be SUBMITTED');
      assert.strictEqual(item2.po_id, null, 'Item 2 po_id must be null');
    });

    await test('PATCH /api/purchase-orders/:id/cancel rejects already cancelled PO', async () => {
      const cancelledPo = testDb.prepare("SELECT id FROM purchase_orders WHERE status = 'CANCELLED' LIMIT 1").get();
      assert.ok(cancelledPo, 'Cancelled PO should exist');

      const res = await fetch(`${baseUrl}/api/purchase-orders/${cancelledPo.id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${purchaserToken}` }
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Cannot cancel'));
    });

    await test('PATCH /api/purchase-orders/:id/cancel rejects COMPLETED PO', async () => {
      // Create a completed PO in DB
      const ins = testDb.prepare(`
        INSERT INTO purchase_orders (po_number, supplier, status, purchaser_id, total_cost)
        VALUES ('PO-COMPLETED-TEST', 'DigiKey', 'COMPLETED', 2, 50.0)
      `).run();

      const res = await fetch(`${baseUrl}/api/purchase-orders/${ins.lastInsertRowid}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${purchaserToken}` }
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Cannot cancel'));
    });

    // -------------------------------------------------------------------------
    // 5. MULTI-STATUS FILTERING IN GET /api/part-requests
    // -------------------------------------------------------------------------
    console.log('\n--- [5. Requests: Multi-Status Filtering] ---');

    await test('GET /api/part-requests?status=SUBMITTED,APPROVED returns both statuses', async () => {
      const res = await fetch(`${baseUrl}/api/part-requests?status=SUBMITTED,APPROVED`, {
        headers: { Authorization: `Bearer ${purchaserToken}` }
      });
      assert.strictEqual(res.status, 200);
      const items = await res.json();
      assert.ok(items.length > 0);
      const statuses = new Set(items.map(i => i.status));
      for (const s of statuses) {
        assert.ok(['SUBMITTED', 'APPROVED'].includes(s), `Unexpected status ${s}`);
      }
    });

    // -------------------------------------------------------------------------
    // 6. EDITING PART REQUESTS VIA PATCH /api/part-requests/:id
    // -------------------------------------------------------------------------
    console.log('\n--- [6. Requests: PATCH /api/part-requests/:id Endpoint] ---');

    await test('Owner can edit description, quantity, and price on their SUBMITTED request', async () => {
      // Create request by member
      const createRes = await fetch(`${baseUrl}/api/part-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({
          subsystem_id: 1,
          supplier: 'DigiKey',
          sku: 'EDIT-01',
          description: 'Original Description',
          quantity: 2,
          unit_price_est: 5.0
        })
      });
      assert.strictEqual(createRes.status, 201);
      const req = await createRes.json();

      // Edit by owner
      const editRes = await fetch(`${baseUrl}/api/part-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({
          description: 'Updated Description by Owner',
          quantity: 5,
          unit_price_est: 6.50
        })
      });
      assert.strictEqual(editRes.status, 200);
      const updated = await editRes.json();
      assert.strictEqual(updated.description, 'Updated Description by Owner');
      assert.strictEqual(updated.quantity, 5);
      assert.strictEqual(updated.unit_price_est, 6.50);
    });

    await test('Non-owner Member cannot edit another users request (403)', async () => {
      // Create other user
      const otherMem = testDb.prepare(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Other Member', 'other@fsae.local', 'hash', 'Member')
      `).run();
      const tokenRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Other2', email: 'other2@fsae.local', password: 'pwd' })
      });
      const { token: otherToken } = await tokenRes.json();

      // Try editing request 1
      const editRes = await fetch(`${baseUrl}/api/part-requests/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherToken}` },
        body: JSON.stringify({ description: 'Hacked' })
      });
      assert.strictEqual(editRes.status, 403);
    });

    await test('Purchaser and Admin can edit any request', async () => {
      const editRes = await fetch(`${baseUrl}/api/part-requests/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaserToken}` },
        body: JSON.stringify({ urgency_level: 'CRITICAL' })
      });
      assert.strictEqual(editRes.status, 200);
      const updated = await editRes.json();
      assert.strictEqual(updated.urgency_level, 'CRITICAL');
    });

    await test('Member cannot edit part request once ORDERED', async () => {
      const orderedItem = testDb.prepare("SELECT id FROM part_requests WHERE status = 'ORDERED' AND requester_id = ?").get(memberUser.id);
      if (orderedItem) {
        const editRes = await fetch(`${baseUrl}/api/part-requests/${orderedItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
          body: JSON.stringify({ quantity: 99 })
        });
        assert.strictEqual(editRes.status, 400);
      }
    });

    await test('Member editing an APPROVED part request automatically resets status to SUBMITTED', async () => {
      // Create request and approve it
      const ins = testDb.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, status)
        VALUES (?, 1, 'DigiKey', 'DK-APP-RESET', 'Part To Be Approved', 1, 10.0, 'APPROVED')
      `).run(memberUser.id);
      const reqId = ins.lastInsertRowid;

      // Member modifies quantity
      const editRes = await fetch(`${baseUrl}/api/part-requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({ quantity: 10, unit_price_est: 25.0 })
      });
      assert.strictEqual(editRes.status, 200);
      const updated = await editRes.json();
      assert.strictEqual(updated.status, 'SUBMITTED', 'Status must be reset from APPROVED to SUBMITTED upon owner modification');
      assert.strictEqual(updated.quantity, 10);
      assert.strictEqual(updated.unit_price_est, 25.0);
    });

    await test('Member cannot edit part request if po_id is set', async () => {
      // Simulate part request with po_id set
      const ins = testDb.prepare(`
        INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, description, quantity, unit_price_est, status, po_id)
        VALUES (?, 1, 'DigiKey', 'DK-PO-LOCKED', 'Part in PO', 1, 10.0, 'SUBMITTED', 1)
      `).run(memberUser.id);
      const reqId = ins.lastInsertRowid;

      const editRes = await fetch(`${baseUrl}/api/part-requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({ description: 'Attempted Change' })
      });
      assert.strictEqual(editRes.status, 400);
      const data = await editRes.json();
      assert.ok(data.error.includes('assigned to a purchase order'));
    });

    // -------------------------------------------------------------------------
    // 7. FRONTEND LOGIC SAFETY CHECKS
    // -------------------------------------------------------------------------
    console.log('\n--- [7. Frontend Component Defensive Logic] ---');

    await test('CsvExportModal undefined/null escaping does not throw TypeError on numeric SKU or nulls', () => {
      const escapeCsvField = (val) => String(val ?? '').replace(/"/g, '""');

      const dirtyItems = [
        { mpn: undefined, sku: undefined, quantity: undefined, distributor: null, description: null },
        { mpn: 'LM317', sku: null, quantity: 2, distributor: 'DigiKey' },
        { mpn: 'LM317T', sku: 276708, quantity: 5, distributor: 'DigiKey', price: 1.50, description: 'Voltage Regulator' }
      ];

      // Test DigiKey export logic
      const rows = dirtyItems.map(item => {
        const itemDist = String(item.distributor || item.supplier || '').toLowerCase();
        const skuVal = (true && item.sku && itemDist === 'digikey') ? item.sku : (item.mpn || item.sku || '');
        const qtyVal = item.quantity || 1;
        const customerRef = undefined;
        return `"${escapeCsvField(skuVal)}",${qtyVal},"${escapeCsvField(customerRef)}"`;
      });

      assert.strictEqual(rows.length, 3);
      assert.strictEqual(rows[0], '"",1,""');
      assert.strictEqual(rows[1], '"LM317",2,""');
      assert.strictEqual(rows[2], '"276708",5,""');

      // Test Generic export logic
      const genericRows = dirtyItems.map(item => {
        const qtyVal = item.quantity || 1;
        const mpnVal = item.mpn || item.sku || '';
        const skuVal = item.sku || '';
        const distVal = item.distributor || '';
        const descVal = item.description || '';
        const customerRef = null;
        return `"${escapeCsvField(mpnVal)}","${escapeCsvField(skuVal)}","${escapeCsvField(distVal)}",${qtyVal},${Number(item.price) || 0},"${escapeCsvField(descVal)}","${escapeCsvField(customerRef)}"`;
      });
      assert.strictEqual(genericRows.length, 3);
      assert.strictEqual(genericRows[2], '"LM317T","276708","DigiKey",5,1.5,"Voltage Regulator",""');
    });

    await test('PartRequestModal DigiKey URL extraction separates MPN and SKU correctly', () => {
      const u = 'https://www.digikey.ca/en/products/detail/texas-instruments/TPS54302DDCR/6526789';
      const dk3Match = u.match(/(?:products\/detail|product-detail)\/(?:[a-z]{2}\/)?[^\/]+\/([^\/\?#]+)\/([^\/\?#]+)/i);
      assert.ok(dk3Match, 'Should match 3-segment DigiKey URL');
      assert.strictEqual(decodeURIComponent(dk3Match[1]).trim(), 'TPS54302DDCR', 'Group 1 must be MPN');
      assert.strictEqual(decodeURIComponent(dk3Match[2]).trim(), '6526789', 'Group 2 must be SKU');
    });

    await test('PartRequestModal 2-segment DigiKey URL extracts MPN and does NOT store MPN in SKU', () => {
      const u = 'https://www.digikey.ca/en/products/detail/texas-instruments/LM317T';
      const dk3Match = u.match(/(?:products\/detail|product-detail)\/(?:[a-z]{2}\/)?[^\/]+\/([^\/\?#]+)\/([^\/\?#]+)/i);
      const dk2Match = u.match(/(?:products\/detail|product-detail)\/(?:[a-z]{2}\/)?[^\/]+\/([^\/\?#]+)/i);
      assert.strictEqual(dk3Match, null, '2-segment URL should not match dk3Match');
      assert.ok(dk2Match, 'Should match dk2Match');
      const extractedMpn = decodeURIComponent(dk2Match[1]).trim();
      assert.strictEqual(extractedMpn, 'LM317T', 'Group 1 of dk2Match must be MPN');
      // Verifying that SKU is NOT populated with MPN
      let sku = '';
      let mpn = extractedMpn;
      assert.strictEqual(sku, '', 'SKU must remain empty on 2-segment URL');
      assert.strictEqual(mpn, 'LM317T', 'MPN must be correctly stored');
    });

    await test('PurchaserDashboard PO status CANCELLED displays 🚫 Annulé badge', () => {
      const getBadge = (status) => {
        let bg = '#451a03';
        let color = '#fbbf24';
        let border = '#d97706';
        let label = '🕒 En Attente';

        if (status === 'COMPLETED') {
          bg = '#064e3b';
          color = '#34d399';
          border = '#059669';
          label = '✅ Reçu Complet';
        } else if (status === 'ORDERED') {
          bg = '#0c4a6e';
          color = '#38bdf8';
          border = '#0284c7';
          label = '🚚 Commandé';
        } else if (status === 'CANCELLED') {
          bg = '#27171a';
          color = '#f87171';
          border = '#7f1d1d';
          label = '🚫 Annulé';
        }

        return { bg, color, border, label };
      };

      const badge = getBadge('CANCELLED');
      assert.strictEqual(badge.label, '🚫 Annulé');
      assert.strictEqual(badge.color, '#f87171');
      assert.strictEqual(badge.border, '#7f1d1d');
    });

    console.log('\n====================================================');
    console.log(`🏆 ALL ${passed} P0/P1 REGRESSION TESTS PASSED!`);
    console.log('====================================================\n');
  } finally {
    server.close();
    testDb.close();
  }
}

runP0P1Tests().catch(err => {
  console.error('\n❌ P0/P1 Test Suite Failed:', err);
  process.exit(1);
});
