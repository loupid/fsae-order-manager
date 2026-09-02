/**
 * Milestone 3 & Milestone 4 Integration & E2E Verification Test Suite
 * - Frontend SPA Assets & Static Hosting
 * - ARM Multi-stage Docker & docker-compose configurations
 * - Full End-to-End User Journey (Auth -> Request -> 1-Click PO -> Invoice Upload -> Receipt -> Financial Report)
 */
import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { runSeed } from '../db/seed.js';
import { createApp } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let passed = 0;
let total = 0;

async function test(title, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✅ [PASS] ${title}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

console.log('====================================================');
console.log('🏁 [TIER 3 & 4] FRONTEND & ARM DEPLOYMENT E2E TESTS');
console.log('====================================================\n');

// 1. Frontend Build Assets Verification
console.log('--- [Section 1: Frontend SPA Production Bundle] ---');

await test('Production build dist/ directory and assets exist', async () => {
  const distPath = path.join(projectRoot, 'dist');
  assert.ok(fs.existsSync(distPath), 'dist/ directory must exist');

  const indexPath = path.join(distPath, 'index.html');
  assert.ok(fs.existsSync(indexPath), 'dist/index.html must exist');

  const htmlContent = fs.readFileSync(indexPath, 'utf-8');
  assert.ok(htmlContent.includes('<div id="root"></div>'), 'index.html must contain root mount point');
  assert.ok(htmlContent.includes('<script type="module"'), 'index.html must load module script');

  const assetsPath = path.join(distPath, 'assets');
  assert.ok(fs.existsSync(assetsPath), 'dist/assets directory must exist');
  const assetFiles = fs.readdirSync(assetsPath);
  assert.ok(assetFiles.some(f => f.endsWith('.js')), 'Compiled JS bundle must exist');
  assert.ok(assetFiles.some(f => f.endsWith('.css')), 'Compiled CSS bundle must exist');
});

// 2. ARM Multi-Stage Dockerfile & docker-compose.yml Verification
console.log('\n--- [Section 2: ARM Dockerfile & Docker-Compose Manifests] ---');

await test('Dockerfile defines ARM-compatible multi-stage build and healthcheck', async () => {
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist');

  const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
  assert.ok(dockerfileContent.includes('FROM node:20-alpine AS frontend-builder'), 'Must have frontend-builder stage');
  assert.ok(dockerfileContent.includes('FROM node:20-alpine AS production'), 'Must have production runtime stage');
  assert.ok(dockerfileContent.includes('COPY --from=frontend-builder /app/dist ./dist'), 'Must copy dist/ assets');
  assert.ok(dockerfileContent.includes('EXPOSE 3000'), 'Must expose port 3000');
  assert.ok(dockerfileContent.includes('HEALTHCHECK'), 'Must include container healthcheck');
  assert.ok(dockerfileContent.includes('server/index.js'), 'Must execute Express server');
});

await test('docker-compose.yml configures persistent volumes and port 3000 mapping', async () => {
  const composePath = path.join(projectRoot, 'docker-compose.yml');
  assert.ok(fs.existsSync(composePath), 'docker-compose.yml must exist');

  const composeContent = fs.readFileSync(composePath, 'utf-8');
  assert.ok(composeContent.includes('3000:3000'), 'Must map port 3000');
  assert.ok(composeContent.includes('./data:/app/data'), 'Must mount persistent data volume for SQLite WAL');
  assert.ok(composeContent.includes('./uploads:/app/uploads'), 'Must mount persistent uploads volume for Invoices');
  assert.ok(composeContent.includes('healthcheck:'), 'Must include healthcheck configuration');
});

// 3. Full End-to-End User Journey Simulation
console.log('\n--- [Section 3: Full End-to-End Lifecycle Simulation] ---');

const testDb = initDatabase(':memory:');
runMigrations(testDb);
runSeed(testDb);

const app = createApp(testDb, null);
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

try {
  // Step 1: User Registration & Authentication
  let memberToken = '';
  let memberId = null;
  let purchaserToken = '';

  await test('E2E: Member registers and receives JWT token with Member role', async () => {
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sophie Martin',
        email: 'sophie.martin@fsae.org',
        password: 'Password123!',
        role: 'Member'
      })
    });
    assert.strictEqual(regRes.status, 201);
    const data = await regRes.json();
    assert.ok(data.token);
    assert.strictEqual(data.user.role, 'Member');
    assert.strictEqual(data.user.email, 'sophie.martin@fsae.org');
    memberToken = data.token;
    memberId = data.user.id;
  });

  await test('E2E: Purchaser authenticates with demo credentials', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'purchaser@fsae.org',
        password: 'purchaser123'
      })
    });
    assert.strictEqual(loginRes.status, 200);
    const data = await loginRes.json();
    assert.strictEqual(data.user.role, 'Purchaser');
    purchaserToken = data.token;
  });

  // Step 2: Vendor URL Parsing & Part Request Creation
  let createdRequestId = null;
  await test('E2E: Member parses DigiKey URL and submits CRITICAL part request', async () => {
    // Live parse
    const parseRes = await fetch(`${baseUrl}/api/parsers/parse-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        url: 'https://www.digikey.ca/en/products/detail/texas-instruments/TPS54302DDCR/6110826'
      })
    });
    assert.strictEqual(parseRes.status, 200);
    const parsed = await parseRes.json();
    assert.strictEqual(parsed.supplier, 'DigiKey');
    assert.strictEqual(parsed.mpn, 'TPS54302DDCR');

    // Create Part Request
    const reqRes = await fetch(`${baseUrl}/api/part-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        subsystem_id: 1, // Powertrain
        supplier: parsed.supplier,
        sku: parsed.sku || parsed.mpn,
        url: 'https://www.digikey.ca/en/products/detail/texas-instruments/TPS54302DDCR/6110826',
        description: 'Buck Regulator 5V 3A pour BMS Master',
        quantity: 4,
        unit_price_est: 3.50,
        urgency_level: 'CRITICAL'
      })
    });
    assert.strictEqual(reqRes.status, 201);
    const req = await reqRes.json();
    assert.strictEqual(req.urgency_level, 'CRITICAL');
    assert.strictEqual(req.supplier, 'DigiKey');
    assert.strictEqual(req.quantity, 4);
    assert.strictEqual(req.requester_id, memberId);
    createdRequestId = req.id;
  });

  // Step 3: Purchaser 1-Click PO Aggregation
  let createdPoId = null;
  let createdPoNumber = '';
  await test('E2E: Purchaser groups pending requests into Purchase Order (1-Click PO)', async () => {
    const poRes = await fetch(`${baseUrl}/api/purchase-orders`, {
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
    assert.strictEqual(poRes.status, 201);
    const po = await poRes.json();
    assert.ok(po.po_number.startsWith('PO-'));
    assert.strictEqual(po.supplier, 'DigiKey');
    assert.strictEqual(po.total_cost, 14.00); // 4 * 3.50
    assert.strictEqual(po.status, 'ORDERED');
    createdPoId = po.id;
    createdPoNumber = po.po_number;
  });

  // Step 4: Invoice Upload & Magic Bytes Inspection
  let uploadedInvoiceId = null;
  await test('E2E: Purchaser attaches valid PDF invoice to Purchase Order', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.7\n%FSAE Official Invoice\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, `Invoice_${createdPoNumber}.pdf`);
    formData.append('amount', '15.25'); // Actual billed amount with shipping

    const invRes = await fetch(`${baseUrl}/api/invoices/po/${createdPoId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${purchaserToken}` },
      body: formData
    });
    assert.strictEqual(invRes.status, 201);
    const invoice = await invRes.json();
    assert.strictEqual(invoice.po_id, createdPoId);
    assert.strictEqual(invoice.amount, 15.25);
    uploadedInvoiceId = invoice.id;
  });

  // Step 5: Parts Arrival & Automatic Cascade
  await test('E2E: Completing Purchase Order marks all linked requests as RECEIVED', async () => {
    const completeRes = await fetch(`${baseUrl}/api/purchase-orders/${createdPoId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${purchaserToken}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.strictEqual(completeRes.status, 200);

    // Verify linked request status
    const reqCheck = await (await fetch(`${baseUrl}/api/part-requests/${createdRequestId}`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    })).json();
    assert.strictEqual(reqCheck.status, 'RECEIVED');
  });

  // Step 6: Subsystem Financial Cost Report Calculation
  await test('E2E: Subsystem financial metrics accurately compute actual and remaining budget', async () => {
    const subRes = await fetch(`${baseUrl}/api/subsystems`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.strictEqual(subRes.status, 200);
    const subsystems = await subRes.json();
    const powertrain = subsystems.find(s => s.id === 1);
    assert.ok(powertrain);
    assert.ok(powertrain.actual_cost >= 14.00);
    assert.strictEqual(powertrain.remaining_budget, powertrain.budget_allocated - (powertrain.committed_cost + powertrain.actual_cost));
  });

} finally {
  server.close();
  testDb.close();
}

console.log('\n====================================================');
console.log(`🏆 ALL ${passed}/${total} E2E & DEPLOYMENT TESTS PASSED WITH 100% SUCCESS!`);
console.log('====================================================\n');
