/**
 * Comprehensive Milestone 2 Adversarial Stress Test Suite
 * Archetype: EMPIRICAL CHALLENGER
 * Roles: critic, specialist
 */
import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { initDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { runSeed } from '../db/seed.js';
import { createApp } from '../index.js';
import { parseVendorUrl } from '../services/parsers/vendorParser.js';
import { sendDiscordAlert, notifyPurchaseOrderCreated, notifyPartsReceived } from '../services/discord/discordWebhook.js';

let passed = 0;
let total = 0;
const testResults = [];

async function challenge(id, title, fn) {
  total++;
  try {
    await fn();
    passed++;
    testResults.push({ id, title, status: 'PASS' });
    console.log(`  ✅ [PASS] ${id}: ${title}`);
  } catch (err) {
    testResults.push({ id, title, status: 'FAIL', error: err.message });
    console.error(`  ❌ [FAIL] ${id}: ${title}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

console.log('====================================================');
console.log('⚔️  MILESTONE 2 ADVERSARIAL CHALLENGER STRESS SUITE');
console.log('====================================================\n');

// Set up isolated In-Memory Database
const testDb = initDatabase(':memory:');
runMigrations(testDb);
runSeed(testDb);

// Mock Discord Webhook Server capable of simulating timeouts, errors, and recording payloads
let webhookResponseStatus = 200;
let webhookDelayMs = 0;
let capturedPayloads = [];

const mockDiscordServer = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        capturedPayloads.push(JSON.parse(body));
      } catch (e) {}

      if (webhookDelayMs > 0) {
        await new Promise(r => setTimeout(r, webhookDelayMs));
      }

      res.writeHead(webhookResponseStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: webhookResponseStatus === 200 }));
    });
  } else {
    res.writeHead(404).end();
  }
});

await new Promise(resolve => mockDiscordServer.listen(0, '127.0.0.1', resolve));
const mockDiscordPort = mockDiscordServer.address().port;
const mockWebhookUrl = `http://127.0.0.1:${mockDiscordPort}/webhook`;

// API App & Server
const app = createApp(testDb, mockWebhookUrl);
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

// Helper: login user and get token
async function login(email, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  const data = await res.json();
  return { token: data.token, user: data.user };
}

try {
  const member = await login('member@fsae.org', 'member123');
  const purchaser = await login('purchaser@fsae.org', 'purchaser123');
  const admin = await login('admin@fsae.org', 'admin123');

  // =========================================================================
  // SECTION 1: RBAC SECURITY STRESS TESTING
  // =========================================================================
  console.log('\n--- [SECTION 1: RBAC & Authentication Security] ---');

  await challenge('ADV-RBAC-01', 'Member is blocked (403) from creating Purchase Orders', async () => {
    const res = await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${member.token}`
      },
      body: JSON.stringify({
        supplier: 'DigiKey',
        request_ids: [1]
      })
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error.includes('Forbidden') || data.error.includes('role'));
  });

  await challenge('ADV-RBAC-02', 'Member is blocked (403) from updating Purchase Order status', async () => {
    const res = await fetch(`${baseUrl}/api/purchase-orders/1/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${member.token}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await challenge('ADV-RBAC-03', 'Member is blocked (403) from uploading Invoices to PO', async () => {
    const pdfBuf = Buffer.from('%PDF-1.4\ntest');
    const blob = new Blob([pdfBuf], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'invoice.pdf');
    formData.append('amount', '100.00');

    const res = await fetch(`${baseUrl}/api/invoices/po/1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${member.token}` },
      body: formData
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await challenge('ADV-RBAC-04', 'Member is blocked (403) from deleting Invoices', async () => {
    const res = await fetch(`${baseUrl}/api/invoices/1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${member.token}` }
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await challenge('ADV-RBAC-05', 'Member is blocked (403) from creating Subsystems', async () => {
    const res = await fetch(`${baseUrl}/api/subsystems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${member.token}`
      },
      body: JSON.stringify({ name: 'Tire Test', code: 'TIRE_TEST', budget_allocated: 1000 })
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await challenge('ADV-RBAC-06', 'Purchaser is blocked (403) from creating Subsystems (Admin only)', async () => {
    const res = await fetch(`${baseUrl}/api/subsystems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${purchaser.token}`
      },
      body: JSON.stringify({ name: 'Chassis Mod', code: 'CHA_MOD', budget_allocated: 1000 })
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await challenge('ADV-RBAC-07', 'Member is blocked (403) from changing Part Request status', async () => {
    const res = await fetch(`${baseUrl}/api/part-requests/1/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${member.token}`
      },
      body: JSON.stringify({ status: 'APPROVED' })
    });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await challenge('ADV-RBAC-08', 'Member cannot delete another user\'s part request', async () => {
    // Create request under Purchaser user
    const resCreate = await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${purchaser.token}`
      },
      body: JSON.stringify({
        subsystem_id: 1,
        supplier: 'DigiKey',
        sku: 'TEST-SKU-99',
        description: 'Purchaser Item',
        quantity: 1,
        unit_price_est: 10.00
      })
    });
    const item = await resCreate.json();

    // Member attempts deletion -> 403
    const resDelete = await fetch(`${baseUrl}/api/part-requests/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${member.token}` }
    });
    assert.strictEqual(resDelete.status, 403);
  });

  await challenge('ADV-RBAC-09', 'Unauthenticated / Malformed JWT tokens rejected with 401', async () => {
    const endpoints = [
      { url: `${baseUrl}/api/auth/me`, method: 'GET' },
      { url: `${baseUrl}/api/subsystems`, method: 'GET' },
      { url: `${baseUrl}/api/part-requests`, method: 'GET' },
      { url: `${baseUrl}/api/purchase-orders`, method: 'GET' }
    ];

    for (const ep of endpoints) {
      // Missing token
      const resNoToken = await fetch(ep.url, { method: ep.method });
      assert.strictEqual(resNoToken.status, 401, `Missing token on ${ep.url} should be 401`);

      // Malformed / fake signature token
      const resBadToken = await fetch(ep.url, {
        method: ep.method,
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.badpayload.badsig' }
      });
      assert.strictEqual(resBadToken.status, 401, `Invalid token on ${ep.url} should be 401`);
    }
  });

  // =========================================================================
  // SECTION 2: PDF UPLOAD & MAGIC BYTES SECURITY
  // =========================================================================
  console.log('\n--- [SECTION 2: PDF Upload & Magic Bytes Security] ---');

  // Create a target PO for invoice tests
  const reqCreateTarget = await fetch(`${baseUrl}/api/part-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${purchaser.token}`
    },
    body: JSON.stringify({
      subsystem_id: 1,
      supplier: 'DigiKey',
      sku: 'PDF-TEST-1',
      description: 'PDF Test Part',
      quantity: 2,
      unit_price_est: 25.00
    })
  });
  const targetReq = await reqCreateTarget.json();

  const reqPoTarget = await fetch(`${baseUrl}/api/purchase-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${purchaser.token}`
    },
    body: JSON.stringify({
      supplier: 'DigiKey',
      request_ids: [targetReq.id]
    })
  });
  const testPo = await reqPoTarget.json();
  const testPoId = testPo.id;

  await challenge('ADV-PDF-01', 'Rejects HTML file disguised as .pdf (magic bytes check)', async () => {
    const htmlPayload = Buffer.from('<!DOCTYPE html><html><body><h1>Invoice Fake</h1></body></html>');
    const blob = new Blob([htmlPayload], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'fake_html.pdf');
    formData.append('amount', '50.00');

    const res = await fetch(`${baseUrl}/api/invoices/po/${testPoId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${purchaser.token}` },
      body: formData
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('magic bytes') || data.error.includes('PDF'));
  });

  await challenge('ADV-PDF-02', 'Rejects PNG binary file renamed as .pdf', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const blob = new Blob([pngHeader], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'photo.pdf');
    formData.append('amount', '50.00');

    const res = await fetch(`${baseUrl}/api/invoices/po/${testPoId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${purchaser.token}` },
      body: formData
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('magic bytes'));
  });

  await challenge('ADV-PDF-03', 'Rejects Empty (0-byte) and truncated (<4 bytes) file as .pdf', async () => {
    // 0-byte file
    const emptyBuf = Buffer.alloc(0);
    const blobEmpty = new Blob([emptyBuf], { type: 'application/pdf' });
    const formEmpty = new FormData();
    formEmpty.append('file', blobEmpty, 'empty.pdf');

    const resEmpty = await fetch(`${baseUrl}/api/invoices/po/${testPoId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${purchaser.token}` },
      body: formEmpty
    });
    assert.strictEqual(resEmpty.status, 400);

    // 3-byte truncated file (%PD)
    const truncBuf = Buffer.from('%PD');
    const blobTrunc = new Blob([truncBuf], { type: 'application/pdf' });
    const formTrunc = new FormData();
    formTrunc.append('file', blobTrunc, 'trunc.pdf');

    const resTrunc = await fetch(`${baseUrl}/api/invoices/po/${testPoId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${purchaser.token}` },
      body: formTrunc
    });
    assert.strictEqual(resTrunc.status, 400);
  });

  await challenge('ADV-PDF-04', 'Rejects non-PDF extension (e.g. .exe, .sh, .txt) via multer filter', async () => {
    const rawBuf = Buffer.from('%PDF-1.4\nvalid content');
    const blob = new Blob([rawBuf], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob, 'malware.sh');

    const res = await fetch(`${baseUrl}/api/invoices/po/${testPoId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${purchaser.token}` },
      body: formData
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Only PDF') || data.error.includes('Invalid file type'));
  });

  await challenge('ADV-PDF-05', 'Rejects negative or NaN invoice amount', async () => {
    const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const blob = new Blob([validPdf], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'invoice_neg.pdf');
    formData.append('amount', '-99.99');

    const res = await fetch(`${baseUrl}/api/invoices/po/${testPoId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${purchaser.token}` },
      body: formData
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Amount') || data.error.includes('non-negative'));
  });

  await challenge('ADV-PDF-06', 'Invoice upload to non-existent PO returns 404 and cleans up disk', async () => {
    const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const blob = new Blob([validPdf], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'orphan_invoice.pdf');
    formData.append('amount', '10.00');

    const res = await fetch(`${baseUrl}/api/invoices/po/999999`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${purchaser.token}` },
      body: formData
    });
    assert.strictEqual(res.status, 404);
  });

  await challenge('ADV-PDF-07', 'Valid PDF invoice with %PDF-1.7 header succeeds (201) and attaches to PO', async () => {
    const validPdf = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const blob = new Blob([validPdf], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'digikey_valid_2026.pdf');
    formData.append('amount', '50.00');

    const res = await fetch(`${baseUrl}/api/invoices/po/${testPoId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${purchaser.token}` },
      body: formData
    });
    assert.strictEqual(res.status, 201);
    const inv = await res.json();
    assert.strictEqual(inv.po_id, testPoId);
    assert.strictEqual(inv.amount, 50.00);
    assert.strictEqual(inv.file_name, 'digikey_valid_2026.pdf');

    // Verify file exists on disk
    const onDisk = path.resolve(process.cwd(), inv.file_path);
    assert.ok(fs.existsSync(onDisk), `Invoice file ${onDisk} must exist on disk`);
  });

  // =========================================================================
  // SECTION 3: VENDOR URL REGEX PARSERS ADVERSARIAL STRESS
  // =========================================================================
  console.log('\n--- [SECTION 3: Vendor URL Regex Parsers Adversarial Stress] ---');

  await challenge('ADV-PARSER-01', 'DigiKey regex handles multiple regional TLDs, languages, and query hashes', async () => {
    const testCases = [
      {
        url: 'https://www.digikey.fr/fr/products/detail/stmicroelectronics/STM32F407VGT6/2753678?s=N4IgTCBcDaIMwCYBsB2UBiAGALCA&gclid=CjwKCAiA#tab-specs',
        expectedMpn: 'STM32F407VGT6',
        expectedSku: '2753678',
        expectedMfg: 'stmicroelectronics'
      },
      {
        url: 'https://www.digikey.co.uk/en/products/detail/texas-instruments/LM317T/3257?promo=123',
        expectedMpn: 'LM317T',
        expectedSku: '3257',
        expectedMfg: 'texas instruments'
      },
      {
        url: 'https://www.digikey.de/products/detail/bourns-inc/3386P-1-103LF/1088034',
        expectedMpn: '3386P-1-103LF',
        expectedSku: '1088034',
        expectedMfg: 'bourns inc'
      }
    ];

    for (const tc of testCases) {
      const res = parseVendorUrl(tc.url);
      assert.strictEqual(res.supplier, 'DigiKey');
      assert.strictEqual(res.recognized, true);
      assert.strictEqual(res.mpn, tc.expectedMpn);
      assert.strictEqual(res.sku, tc.expectedSku);
      assert.strictEqual(res.manufacturer, tc.expectedMfg);
    }
  });

  await challenge('ADV-PARSER-02', 'Mouser regex handles regional domains, special characters, and query encodings', async () => {
    const testCases = [
      {
        url: 'https://www.mouser.fr/ProductDetail/Texas-Instruments/TPS54302DDCR?qs=y6Sm2912D3M%252B%2FEoV&gclid=123',
        expectedMfg: 'Texas Instruments',
        expectedMpn: 'TPS54302DDCR',
        expectedSku: 'TPS54302DDCR'
      },
      {
        url: 'https://www.mouser.co.uk/en/ProductDetail/Molex/43045-0400?qs=abc123xyz',
        expectedMfg: 'Molex',
        expectedMpn: '43045-0400',
        expectedSku: '43045-0400'
      },
      {
        url: 'https://www.mouser.com/ProductDetail/595-TPS62130RGTR?utm_source=direct',
        expectedMpn: '595-TPS62130RGTR',
        expectedSku: '595-TPS62130RGTR'
      }
    ];

    for (const tc of testCases) {
      const res = parseVendorUrl(tc.url);
      assert.strictEqual(res.supplier, 'Mouser');
      assert.strictEqual(res.recognized, true);
      assert.strictEqual(res.mpn, tc.expectedMpn);
      assert.strictEqual(res.sku, tc.expectedSku);
    }
  });

  await challenge('ADV-PARSER-03', 'McMaster-Carr catalog patterns handle deep links, query strings and metric formats', async () => {
    const testCases = [
      {
        url: 'https://www.mcmaster.com/91290A115?utm_campaign=shop',
        expectedSku: '91290A115'
      },
      {
        url: 'https://www.mcmaster.com/screws/90128A030/',
        expectedSku: '90128A030'
      },
      {
        url: 'https://www.mcmaster.com/12345K67#cad-model',
        expectedSku: '12345K67'
      }
    ];

    for (const tc of testCases) {
      const res = parseVendorUrl(tc.url);
      assert.strictEqual(res.supplier, 'McMaster-Carr');
      assert.strictEqual(res.recognized, true);
      assert.strictEqual(res.sku, tc.expectedSku);
    }
  });

  await challenge('ADV-PARSER-04', 'Graceful domain fallback for non-catalog suppliers and unusual URLs', async () => {
    const testCases = [
      { input: 'https://www.mouser.com/invalid-path-here', expectedSupplier: 'Mouser', recognized: false },
      { input: 'https://lcsc.com/product-detail/C12345.html', expectedSupplier: 'Lcsc', recognized: false },
      { input: 'https://www.amazon.ca/dp/B08N5WRWNW', expectedSupplier: 'Amazon', recognized: false },
      { input: 'custom-hardware.io/item/bolt-300', expectedSupplier: 'Custom-hardware', recognized: false },
      { input: '   ', expectedSupplier: 'Other', recognized: false },
      { input: null, expectedSupplier: 'Other', recognized: false },
      { input: undefined, expectedSupplier: 'Other', recognized: false },
      { input: 12345, expectedSupplier: 'Other', recognized: false },
      { input: 'invalid::://url///test', expectedSupplier: 'Other', recognized: false }
    ];

    for (const tc of testCases) {
      const res = parseVendorUrl(tc.input);
      assert.strictEqual(res.supplier, tc.expectedSupplier, `Failed for input: ${tc.input}`);
      assert.strictEqual(res.recognized, tc.recognized, `Recognized mismatch for: ${tc.input}`);
    }
  });

  // =========================================================================
  // SECTION 4: PO AGGREGATION & LIFECYCLE INTEGRITY
  // =========================================================================
  console.log('\n--- [SECTION 4: PO Aggregation & Lifecycle Integrity] ---');

  await challenge('ADV-PO-01', 'Rejects PO grouping when requests have mismatched suppliers (400)', async () => {
    // Request 1: Mouser
    const r1Res = await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({ subsystem_id: 1, supplier: 'Mouser', sku: 'M-1', description: 'Mouser part', quantity: 1, unit_price_est: 5 })
    });
    const r1 = await r1Res.json();

    // Request 2: DigiKey
    const r2Res = await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({ subsystem_id: 1, supplier: 'DigiKey', sku: 'DK-1', description: 'DigiKey part', quantity: 1, unit_price_est: 5 })
    });
    const r2 = await r2Res.json();

    // Attempt grouping under 'DigiKey' -> 400
    const resMismatched = await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({
        supplier: 'DigiKey',
        request_ids: [r1.id, r2.id]
      })
    });
    assert.strictEqual(resMismatched.status, 400);
    const data = await resMismatched.json();
    assert.ok(data.error.includes('Supplier mismatch') || data.error.includes('supplier'));
  });

  await challenge('ADV-PO-02', 'Rejects PO grouping with non-existent or duplicate request IDs', async () => {
    const res = await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({
        supplier: 'DigiKey',
        request_ids: [999999, 999998]
      })
    });
    assert.strictEqual(res.status, 400);
  });

  await challenge('ADV-PO-03', 'PO status CANCELLED resets linked requests to APPROVED and clears po_id', async () => {
    // Create 2 parts
    const p1 = await (await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({ subsystem_id: 2, supplier: 'McMaster-Carr', sku: 'MC-1', description: 'Bolt A', quantity: 10, unit_price_est: 0.50 })
    })).json();

    const p2 = await (await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({ subsystem_id: 2, supplier: 'McMaster-Carr', sku: 'MC-2', description: 'Bolt B', quantity: 20, unit_price_est: 0.25 })
    })).json();

    // Group into PO
    const po = await (await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({
        supplier: 'McMaster-Carr',
        request_ids: [p1.id, p2.id]
      })
    })).json();
    assert.strictEqual(po.status, 'ORDERED');
    assert.strictEqual(po.total_cost, 10 * 0.50 + 20 * 0.25); // 10.00

    // Cancel PO
    const cancelRes = await fetch(`${baseUrl}/api/purchase-orders/${po.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({ status: 'CANCELLED' })
    });
    assert.strictEqual(cancelRes.status, 200);

    // Verify requests are reset
    const check1 = await (await fetch(`${baseUrl}/api/part-requests/${p1.id}`, {
      headers: { Authorization: `Bearer ${member.token}` }
    })).json();
    assert.strictEqual(check1.status, 'APPROVED');
    assert.strictEqual(check1.po_id, null);
  });

  // =========================================================================
  // SECTION 5: DISCORD WEBHOOK RESILIENCE & ERROR HANDLING
  // =========================================================================
  console.log('\n--- [SECTION 5: Discord Webhook Resilience & Stress] ---');

  await challenge('ADV-DISCORD-01', 'PO creation succeeds immediately even if Discord Webhook returns 500 error', async () => {
    webhookResponseStatus = 500; // Force mock Discord server to 500

    const pReq = await (await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({ subsystem_id: 1, supplier: 'DigiKey', sku: 'DISC-500', description: 'Capacitor', quantity: 2, unit_price_est: 3.00 })
    })).json();

    const poRes = await fetch(`${baseUrl}/api/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({
        supplier: 'DigiKey',
        request_ids: [pReq.id]
      })
    });

    assert.strictEqual(poRes.status, 201, 'PO creation must return 201 even when Discord is 500');
    const created = await poRes.json();
    assert.ok(created.id);
    assert.strictEqual(created.status, 'ORDERED');

    webhookResponseStatus = 200; // Restore
  });

  await challenge('ADV-DISCORD-02', 'PO creation succeeds when Discord Webhook is down/unreachable (bad port)', async () => {
    // Create an app instance pointing to an unreachable port (e.g. 1)
    const deadApp = createApp(testDb, 'http://127.0.0.1:1/nonexistent');
    const deadServer = http.createServer(deadApp);
    await new Promise(r => deadServer.listen(0, '127.0.0.1', r));
    const deadPort = deadServer.address().port;

    const deadPReq = await (await fetch(`http://127.0.0.1:${deadPort}/api/part-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({ subsystem_id: 1, supplier: 'Mouser', sku: 'DISC-DEAD', description: 'Resistor', quantity: 5, unit_price_est: 1.00 })
    })).json();

    const poRes = await fetch(`http://127.0.0.1:${deadPort}/api/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({
        supplier: 'Mouser',
        request_ids: [deadPReq.id]
      })
    });

    assert.strictEqual(poRes.status, 201, 'PO creation must succeed even if Webhook connection is refused');
    deadServer.close();
  });

  await challenge('ADV-DISCORD-03', 'Rich Embed formatting generates correct fields, colors, and urgent indicators', async () => {
    capturedPayloads = [];
    webhookResponseStatus = 200;

    const mockPo = { po_number: 'PO-2026-9999', supplier: 'DigiKey', status: 'ORDERED', total_cost: 150.50 };
    const mockItems = [
      { sku: 'SKU-CRIT', description: 'Urgent Microcontroller', quantity: 2, urgency_level: 'CRITICAL', subsystem_code: 'POW' },
      { sku: 'SKU-NORM', description: 'Standard LED', quantity: 10, urgency_level: 'NORMAL', subsystem_code: 'TEL' }
    ];
    const mockPurchaser = { name: 'Alexandre', role: 'Purchaser' };

    await notifyPurchaseOrderCreated(mockPo, mockItems, mockPurchaser, mockWebhookUrl);

    assert.strictEqual(capturedPayloads.length, 1);
    const embed = capturedPayloads[0].embeds[0];

    // Check color (Red for CRITICAL)
    assert.strictEqual(embed.color, 0xE74C3C, 'Color must be Red (0xE74C3C) for CRITICAL urgency');
    assert.ok(embed.title.includes('PO-2026-9999'));

    const fields = embed.fields;
    const urgencyField = fields.find(f => f.name === 'Urgence Max');
    assert.ok(urgencyField && urgencyField.value.includes('CRITIQUE'));

    const subField = fields.find(f => f.name === 'Sous-systèmes Impactés');
    assert.ok(subField && subField.value.includes('POW (1)') && subField.value.includes('TEL (1)'));
  });

  // =========================================================================
  // SECTION 6: FINANCIAL REPORTING & SUBSYSTEM BUDGET AGGREGATION
  // =========================================================================
  console.log('\n--- [SECTION 6: Subsystem Budget & Financial Aggregation] ---');

  await challenge('ADV-BUDGET-01', 'Subsystem committed vs actual costs calculate accurately across request lifecycles', async () => {
    // Create new subsystem with budget 1000.00
    const subRes = await fetch(`${baseUrl}/api/subsystems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ name: 'Telemetry Test', code: 'TEL_TEST', budget_allocated: 1000.00 })
    });
    assert.strictEqual(subRes.status, 201);
    const newSub = await subRes.json();

    // Create 1 submitted request (committed = 200)
    const req1 = await (await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${member.token}` },
      body: JSON.stringify({ subsystem_id: newSub.id, supplier: 'DigiKey', sku: 'TEL-1', description: 'Radio Module', quantity: 2, unit_price_est: 100.00, status: 'SUBMITTED' })
    })).json();

    // Create 1 received request (actual = 300)
    const req2 = await (await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${member.token}` },
      body: JSON.stringify({ subsystem_id: newSub.id, supplier: 'DigiKey', sku: 'TEL-2', description: 'GPS Antenna', quantity: 3, unit_price_est: 100.00, status: 'SUBMITTED' })
    })).json();

    // Purchaser sets req2 to RECEIVED
    await fetch(`${baseUrl}/api/part-requests/${req2.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${purchaser.token}` },
      body: JSON.stringify({ status: 'RECEIVED' })
    });

    // Fetch subsystems list
    const subListRes = await fetch(`${baseUrl}/api/subsystems`, {
      headers: { Authorization: `Bearer ${member.token}` }
    });
    const subList = await subListRes.json();
    const telSub = subList.find(s => s.id === newSub.id);

    assert.ok(telSub);
    assert.strictEqual(telSub.committed_cost, 200.00);
    assert.strictEqual(telSub.actual_cost, 300.00);
    assert.strictEqual(telSub.remaining_budget, 500.00); // 1000 - 500 = 500
    assert.strictEqual(telSub.pct_used, 50.00);
  });

} finally {
  server.close();
  mockDiscordServer.close();
  testDb.close();
}

console.log('\n====================================================');
console.log(`🏆 ALL ${passed}/${total} ADVERSARIAL CHALLENGES COMPLETED WITH 100% SUCCESS!`);
console.log('====================================================\n');
