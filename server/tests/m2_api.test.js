/**
 * Milestone 2 REST API Integration Test Suite
 * Covers Auth, RBAC, Subsystems, Part Requests, Purchase Orders, PDF Uploads & Magic Bytes, Discord Webhooks.
 */
import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { initDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { runSeed } from '../db/seed.js';
import { createApp } from '../index.js';
import { sendDiscordAlert, notifyPurchaseOrderCreated, notifyPartsReceived } from '../services/discord/discordWebhook.js';

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

console.log('----------------------------------------------------');
console.log('🧪 RUNNING MILESTONE 2 REST API INTEGRATION TESTS');
console.log('----------------------------------------------------');

// Test Setup: In-Memory Database & Test Server
const testDb = initDatabase(':memory:');
runMigrations(testDb);
runSeed(testDb);

// Mock Discord Webhook Collector Server
let capturedWebhookPayloads = [];
let webhookResponseStatus = 200;

const mockDiscordServer = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        capturedWebhookPayloads.push(JSON.parse(body));
      } catch (e) {}
      res.writeHead(webhookResponseStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  } else {
    res.writeHead(404).end();
  }
});

await new Promise((resolve) => mockDiscordServer.listen(0, '127.0.0.1', resolve));
const mockDiscordPort = mockDiscordServer.address().port;
const mockWebhookUrl = `http://127.0.0.1:${mockDiscordPort}/webhook`;

// API Express Server
const app = createApp(testDb, mockWebhookUrl);
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

// Global auth tokens for test personas
let memberToken = '';
let purchaserToken = '';
let adminToken = '';
let memberUser = null;
let purchaserUser = null;
let adminUser = null;

try {
  // 1. AUTH & RBAC TESTS
  await test('T2-AUTH-01: User Registration creates user and returns JWT token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Member',
        email: 'new_member@fsae.local',
        password: 'password123',
        role: 'Member'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.token, 'Token should be returned');
    assert.strictEqual(data.user.email, 'new_member@fsae.local');
    assert.strictEqual(data.user.role, 'Member');
  });

  await test('T2-AUTH-02: User Registration rejects duplicate email', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Member',
        email: 'new_member@fsae.local',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.ok(data.error.includes('already registered'));
  });

  await test('T2-AUTH-03: User Login with Seed Personas', async () => {
    // Login as Member
    const resMember = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@fsae.org', password: 'member123' })
    });
    assert.strictEqual(resMember.status, 200);
    const memberData = await resMember.json();
    memberToken = memberData.token;
    memberUser = memberData.user;
    assert.strictEqual(memberUser.role, 'Member');

    // Login as Purchaser
    const resPurchaser = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'purchaser@fsae.org', password: 'purchaser123' })
    });
    assert.strictEqual(resPurchaser.status, 200);
    const purchaserData = await resPurchaser.json();
    purchaserToken = purchaserData.token;
    purchaserUser = purchaserData.user;
    assert.strictEqual(purchaserUser.role, 'Purchaser');

    // Login as Admin
    const resAdmin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@fsae.org', password: 'admin123' })
    });
    assert.strictEqual(resAdmin.status, 200);
    const adminData = await resAdmin.json();
    adminToken = adminData.token;
    adminUser = adminData.user;
    assert.strictEqual(adminUser.role, 'Admin');
  });

  await test('T2-AUTH-04: Login rejects invalid password and unknown email', async () => {
    const resWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@fsae.org', password: 'wrongpassword' })
    });
    assert.strictEqual(resWrongPass.status, 401);

    const resNoUser = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@fsae.org', password: 'password123' })
    });
    assert.strictEqual(resNoUser.status, 401);
  });

  await test('T2-AUTH-05: GET /api/auth/me returns authenticated user details', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.email, 'member@fsae.org');

    // Unauthenticated call should fail 401
    const resNoToken = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(resNoToken.status, 401);
  });

  // 2. SUBSYSTEMS & BUDGET TESTS
  await test('T2-SUBSYSTEMS-01: GET /api/subsystems returns financial aggregation', async () => {
    const res = await fetch(`${baseUrl}/api/subsystems`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.strictEqual(res.status, 200);
    const subsystems = await res.json();
    assert.ok(Array.isArray(subsystems));
    assert.ok(subsystems.length >= 5);

    const ele = subsystems.find(s => s.code === 'ELE');
    assert.ok(ele, 'Team Électrique subsystem should exist');
    assert.ok(ele.budget_allocated > 0);
    assert.ok(typeof ele.committed_cost === 'number');
    assert.ok(typeof ele.actual_cost === 'number');
    assert.ok(typeof ele.remaining_budget === 'number');
  });

  await test('T2-SUBSYSTEMS-02: POST /api/subsystems RBAC (Admin only)', async () => {
    // Member should be blocked (403)
    const resMember = await fetch(`${baseUrl}/api/subsystems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({ name: 'Aerodynamics', code: 'AERO_TEST', budget_allocated: 4000 })
    });
    assert.strictEqual(resMember.status, 403);

    // Admin should succeed (201)
    const resAdmin = await fetch(`${baseUrl}/api/subsystems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Aerodynamics Extra', code: 'AERO_EXTRA', budget_allocated: 5000 })
    });
    assert.strictEqual(resAdmin.status, 201);
    const created = await resAdmin.json();
    assert.strictEqual(created.code, 'AERO_EXTRA');
    assert.strictEqual(created.budget_allocated, 5000);
  });

  // 3. PART REQUESTS TESTS
  let createdRequestId = null;
  await test('T2-REQUESTS-01: Member creates part request with CRITICAL urgency', async () => {
    const res = await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        subsystem_id: 1, // Powertrain
        supplier: 'DigiKey',
        sku: '6526789',
        url: 'https://www.digikey.com/en/products/detail/texas-instruments/TPS54302DDCR/6526789',
        description: 'Buck Converter IC 28V 3A',
        quantity: 5,
        unit_price_est: 2.75,
        urgency_level: 'CRITICAL'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    createdRequestId = data.id;
    assert.strictEqual(data.urgency_level, 'CRITICAL');
    assert.strictEqual(data.status, 'SUBMITTED');
    assert.strictEqual(data.requester_name, 'Alexandre Tremblay');
  });

  await test('T2-REQUESTS-02: Filter part requests by urgency and supplier', async () => {
    const res = await fetch(`${baseUrl}/api/part-requests?urgency_level=CRITICAL&supplier=DigiKey`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.strictEqual(res.status, 200);
    const list = await res.json();
    assert.ok(list.length >= 1);
    assert.ok(list.every(r => r.urgency_level === 'CRITICAL' && r.supplier.includes('DigiKey')));
  });

  await test('T2-REQUESTS-03: Purchaser updates part request status', async () => {
    const res = await fetch(`${baseUrl}/api/part-requests/${createdRequestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${purchaserToken}`
      },
      body: JSON.stringify({ status: 'APPROVED' })
    });

    assert.strictEqual(res.status, 200);
    const updated = await res.json();
    assert.strictEqual(updated.status, 'APPROVED');
  });

  // 4. PURCHASE ORDERS & 1-CLICK GROUPING
  let createdPoId = null;
  let createdPoNumber = null;

  await test('T2-PO-01: Purchaser creates 1-Click PO grouping DigiKey requests', async () => {
    capturedWebhookPayloads = []; // reset webhook collector

    // Create a second DigiKey request to group
    const resReq2 = await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        subsystem_id: 1,
        supplier: 'DigiKey',
        sku: '252490',
        description: 'Molex Micro-Fit 3.0 Connector',
        quantity: 10,
        unit_price_est: 1.50,
        urgency_level: 'URGENT'
      })
    });
    const req2 = await resReq2.json();

    // Group both into PO
    const resPo = await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${purchaserToken}`
      },
      body: JSON.stringify({
        supplier: 'DigiKey',
        request_ids: [createdRequestId, req2.id]
      })
    });

    assert.strictEqual(resPo.status, 201);
    const po = await resPo.json();
    createdPoId = po.id;
    createdPoNumber = po.po_number;
    assert.ok(po.po_number.startsWith('PO-'));
    assert.strictEqual(po.supplier, 'DigiKey');
    assert.strictEqual(po.status, 'ORDERED');
    assert.strictEqual(po.items.length, 2);
    // Cost: 5 * 2.75 + 10 * 1.50 = 13.75 + 15.00 = 28.75
    assert.strictEqual(po.total_cost, 28.75);

    // Wait a brief moment for non-blocking async webhook
    await new Promise(r => setTimeout(r, 100));
    assert.ok(capturedWebhookPayloads.length >= 1, 'Discord Webhook payload should have been emitted');
    const embed = capturedWebhookPayloads[0].embeds[0];
    assert.ok(embed.title.includes(po.po_number));
    assert.strictEqual(embed.color, 0xE74C3C, 'Color should be Red (0xE74C3C) for CRITICAL urgency');
  });

  await test('T2-PO-02: PO creation rejects supplier mismatch and already assigned requests', async () => {
    // Create McMaster request
    const resMcMaster = await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        subsystem_id: 2,
        supplier: 'McMaster-Carr',
        sku: '91290A115',
        description: 'M3 Socket Head Screws',
        quantity: 100,
        unit_price_est: 0.12,
        urgency_level: 'NORMAL'
      })
    });
    const mcmasterReq = await resMcMaster.json();

    // Attempt to group McMaster request under DigiKey PO -> 400
    const resMismatch = await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${purchaserToken}`
      },
      body: JSON.stringify({
        supplier: 'DigiKey',
        request_ids: [mcmasterReq.id]
      })
    });
    assert.strictEqual(resMismatch.status, 400);

    // Attempt to re-group already ordered request -> 400
    const resReassign = await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${purchaserToken}`
      },
      body: JSON.stringify({
        supplier: 'DigiKey',
        request_ids: [createdRequestId]
      })
    });
    assert.strictEqual(resReassign.status, 400);
  });

  await test('T2-PO-03: Transition PO status to COMPLETED triggers parts received alert and updates items', async () => {
    capturedWebhookPayloads = []; // reset

    const res = await fetch(`${baseUrl}/api/purchase-orders/${createdPoId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${purchaserToken}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });

    assert.strictEqual(res.status, 200);
    const updatedPo = await res.json();
    assert.strictEqual(updatedPo.status, 'COMPLETED');

    // Verify child requests are now RECEIVED
    const resCheckReq = await fetch(`${baseUrl}/api/part-requests/${createdRequestId}`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    const checkReq = await resCheckReq.json();
    assert.strictEqual(checkReq.status, 'RECEIVED');

    // Verify Discord Webhook notification
    await new Promise(r => setTimeout(r, 100));
    assert.ok(capturedWebhookPayloads.length >= 1);
    const embed = capturedWebhookPayloads[0].embeds[0];
    assert.ok(embed.title.includes('Pièces Reçues'));
    assert.strictEqual(embed.color, 0x9B59B6, 'Color should be Purple (0x9B59B6) for Parts Received');
  });

  // 5. INVOICES & MAGIC BYTES VALIDATION
  let createdInvoiceId = null;

  await test('T2-INVOICE-01: Upload valid PDF invoice with %PDF magic bytes attaches to PO', async () => {
    // Generate valid mock PDF buffer
    const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const blob = new Blob([validPdfBuffer], { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', blob, 'digikey_invoice_1001.pdf');
    formData.append('amount', '28.75');

    const res = await fetch(`${baseUrl}/api/invoices/po/${createdPoId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${purchaserToken}`
      },
      body: formData
    });

    assert.strictEqual(res.status, 201);
    const invoice = await res.json();
    createdInvoiceId = invoice.id;
    assert.strictEqual(invoice.po_id, createdPoId);
    assert.strictEqual(invoice.amount, 28.75);
    assert.strictEqual(invoice.file_name, 'digikey_invoice_1001.pdf');
    assert.ok(fs.existsSync(path.resolve(process.cwd(), invoice.file_path)));
  });

  await test('T2-INVOICE-02: Upload invalid file disguised as .pdf fails magic bytes verification (400)', async () => {
    // Malicious or invalid text file renamed to .pdf
    const fakePdfBuffer = Buffer.from('NOT A REAL PDF FILE CONTENT AT ALL');
    const blob = new Blob([fakePdfBuffer], { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', blob, 'fake_invoice.pdf');
    formData.append('amount', '50.00');

    const res = await fetch(`${baseUrl}/api/invoices/po/${createdPoId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${purchaserToken}`
      },
      body: formData
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('magic bytes'));
  });

  await test('T2-INVOICE-03: Stream download attached invoice with application/pdf Content-Type', async () => {
    const res = await fetch(`${baseUrl}/api/invoices/${createdInvoiceId}/download`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
    const bodyText = await res.text();
    assert.ok(bodyText.startsWith('%PDF'));
  });

  // 6. PARSER ROUTE TEST
  await test('T2-PARSER-01: POST /api/parsers/parse-url extracts metadata from URL', async () => {
    const res = await fetch(`${baseUrl}/api/parsers/parse-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.digikey.com/en/products/detail/texas-instruments/TPS54302DDCR/6526789'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.supplier, 'DigiKey');
    assert.strictEqual(data.sku, '6526789');
    assert.strictEqual(data.mpn, 'TPS54302DDCR');
    assert.strictEqual(data.recognized, true);
  });

  // 7. DISCORD SERVICE RESILIENCE TESTS
  await test('T2-DISCORD-01: sendDiscordAlert gracefully handles 500 error without throwing', async () => {
    webhookResponseStatus = 500;
    const result = await sendDiscordAlert({ content: 'Test alert' }, mockWebhookUrl);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 500);
    webhookResponseStatus = 200; // restore
  });

  await test('T2-DISCORD-02: sendDiscordAlert skips when no URL configured', async () => {
    const result = await sendDiscordAlert({ content: 'Test' }, '');
    assert.strictEqual(result.skipped, true);
  });

} finally {
  server.close();
  mockDiscordServer.close();
  testDb.close();
}

console.log(`\n🎉 All ${passed}/${total} Milestone 2 REST API Tests Passed Successfully!\n`);
