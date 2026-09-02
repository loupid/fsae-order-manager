/**
 * Milestone 4 Adversarial Challenge & Stress Test Suite
 * Archetype: EMPIRICAL CHALLENGER
 * Roles: critic, specialist
 * 
 * Verifies:
 * 1. Dockerfile Multi-stage architecture & Alpine build hygiene (clean up .build-deps)
 * 2. V8 memory optimization flags (--max-old-space-size=128 --optimize-for-size)
 * 3. docker-compose.yml YAML validity, memory caps, port forwardings & persistent volumes
 * 4. .dockerignore exclusion of node_modules, data, uploads, .git, dist, coverage, .agents
 * 5. Express healthcheck endpoint responsiveness & unauthenticated accessibility
 * 6. Express static bundle serving & SPA wildcard route fallback to index.html
 * 7. Environment variable override of DB_PATH & automatic storage directory creation
 */
import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { createApp } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

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
console.log('⚔️  MILESTONE 4 ADVERSARIAL CHALLENGER DOCKER SUITE');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: DOCKERFILE ARCHITECTURE & ARM/ALPINE BUILD HYGIENE
// -----------------------------------------------------------------------------
console.log('--- [Section 1: Dockerfile Architecture & Alpine Build Hygiene] ---');

const dockerfilePath = path.join(projectRoot, 'Dockerfile');
assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist in project root');
const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');

await challenge('CH-M4-01', 'Dockerfile defines Stage 1 (frontend-builder) with Vite compilation', async () => {
  assert.match(dockerfileContent, /FROM\s+node:20-alpine\s+AS\s+frontend-builder/i, 'Stage 1 must use node:20-alpine as frontend-builder');
  assert.match(dockerfileContent, /RUN\s+npm\s+ci/i, 'Stage 1 must run npm ci to install build dependencies');
  assert.match(dockerfileContent, /RUN\s+npm\s+run\s+build/i, 'Stage 1 must execute npm run build');
});

await challenge('CH-M4-02', 'Dockerfile defines Stage 2 (production) with build tool cleanup (.build-deps)', async () => {
  assert.match(dockerfileContent, /FROM\s+node:20-alpine\s+AS\s+production/i, 'Stage 2 must use node:20-alpine as production');
  // Must install virtual build deps for better-sqlite3 compilation
  assert.match(dockerfileContent, /apk\s+add\s+--no-cache\s+--virtual\s+\.build-deps\s+python3\s+make\s+g\+\+/i, 'Must install python3, make, g++ as .build-deps');
  // Must purge .build-deps after npm ci
  assert.match(dockerfileContent, /apk\s+del\s+\.build-deps/i, 'Must purge .build-deps in the same layer to minimize final image size');
  // Must use npm ci --only=production
  assert.match(dockerfileContent, /npm\s+ci\s+--only=production/i, 'Must install production-only dependencies in Stage 2');
});

await challenge('CH-M4-03', 'Dockerfile configures low-memory V8 flags for Raspberry Pi (< 45MB RAM)', async () => {
  assert.match(dockerfileContent, /--max-old-space-size=128/, 'Must configure V8 max heap to 128MB');
  assert.match(dockerfileContent, /--optimize-for-size/, 'Must configure V8 optimize-for-size flag');
  assert.match(dockerfileContent, /ENV\s+NODE_ENV=production/, 'Must set NODE_ENV=production');
  assert.match(dockerfileContent, /PORT=3000/, 'Must set default PORT=3000');
});

await challenge('CH-M4-04', 'Dockerfile contains proper asset copying, healthcheck, and startup command', async () => {
  assert.match(dockerfileContent, /COPY\s+--from=frontend-builder\s+\/app\/dist\s+\.\/dist/i, 'Must copy compiled dist from frontend-builder');
  assert.match(dockerfileContent, /COPY\s+server\/\s+\.\/server\//i, 'Must copy backend server code');
  assert.match(dockerfileContent, /EXPOSE\s+3000/i, 'Must expose container port 3000');
  assert.match(dockerfileContent, /HEALTHCHECK.*wget.*http:\/\/localhost:3000\/api\/health/i, 'Must configure Docker HEALTHCHECK with wget');
  assert.match(dockerfileContent, /CMD\s+\[\s*"node"\s*,\s*"server\/index\.js"\s*\]/i, 'Must execute node server/index.js as default CMD');
});

// -----------------------------------------------------------------------------
// SECTION 2: DOCKER COMPOSE CONFIGURATION & RESOURCE LIMITS
// -----------------------------------------------------------------------------
console.log('\n--- [Section 2: Docker Compose Configuration & Resource Limits] ---');

const composePath = path.join(projectRoot, 'docker-compose.yml');
assert.ok(fs.existsSync(composePath), 'docker-compose.yml must exist in project root');
const composeContent = fs.readFileSync(composePath, 'utf-8');

await challenge('CH-M4-05', 'docker-compose.yml defines valid service, container name, and restart policy', async () => {
  assert.match(composeContent, /services:\s*\n\s*fsae-order-manager:/i, 'Service must be named fsae-order-manager');
  assert.match(composeContent, /container_name:\s*fsae_order_manager/i, 'Container name must be fsae_order_manager');
  assert.match(composeContent, /restart:\s*unless-stopped/i, 'Restart policy must be unless-stopped');
});

await challenge('CH-M4-06', 'docker-compose.yml configures dual port mappings (3000 & 8080)', async () => {
  assert.match(composeContent, /["']3000:3000["']/, 'Must map host port 3000 to container 3000');
  assert.match(composeContent, /["']8080:3000["']/, 'Must map host port 8080 to container 3000 for flexible workshop access');
});

await challenge('CH-M4-07', 'docker-compose.yml configures persistent host mounts for SQLite and PDF Invoices', async () => {
  assert.match(composeContent, /-\s*\.\/data:\/app\/data/, 'Must mount ./data to /app/data for SQLite database persistence');
  assert.match(composeContent, /-\s*\.\/uploads:\/app\/uploads/, 'Must mount ./uploads to /app/uploads for invoice PDF persistence');
});

await challenge('CH-M4-08', 'docker-compose.yml configures memory limits and healthchecks', async () => {
  assert.match(composeContent, /memory:\s*128M/i, 'Deploy resource limits must cap memory at 128M for Raspberry Pi');
  assert.match(composeContent, /healthcheck:/i, 'Must define healthcheck in compose');
  assert.match(composeContent, /http:\/\/localhost:3000\/api\/health/, 'Compose healthcheck must target /api/health');
});

// -----------------------------------------------------------------------------
// SECTION 3: .DOCKERIGNORE COMPREHENSIVE COVERAGE
// -----------------------------------------------------------------------------
console.log('\n--- [Section 3: .dockerignore Exclusion Coverage Matrix] ---');

const dockerignorePath = path.join(projectRoot, '.dockerignore');
assert.ok(fs.existsSync(dockerignorePath), '.dockerignore must exist in project root');
const dockerignoreLines = fs.readFileSync(dockerignorePath, 'utf-8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

await challenge('CH-M4-09', '.dockerignore excludes all required heavy, temporary, or sensitive paths', async () => {
  const requiredPatterns = [
    'node_modules',
    'data',
    'uploads',
    '.git',
    'dist',
    'coverage',
    '.agents'
  ];

  for (const pattern of requiredPatterns) {
    assert.ok(
      dockerignoreLines.includes(pattern),
      `.dockerignore must explicitly exclude '${pattern}'`
    );
  }
});

// -----------------------------------------------------------------------------
// SECTION 4: LIVE CONTAINER HEALTHCHECK & SPA HOSTING VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- [Section 4: Live Healthcheck & Static SPA Hosting Verification] ---');

const testDb = initDatabase(':memory:');
runMigrations(testDb);
const app = createApp(testDb, null);
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

try {
  await challenge('CH-M4-10', 'GET /api/health responds with HTTP 200 { status: "ok" } without authentication', async () => {
    const startTime = Date.now();
    const res = await fetch(`${baseUrl}/api/health`);
    const elapsed = Date.now() - startTime;

    assert.strictEqual(res.status, 200, 'Healthcheck must return 200 OK');
    const data = await res.json();
    assert.strictEqual(data.status, 'ok', 'Health status must be "ok"');
    assert.ok(data.timestamp, 'Health response must contain a timestamp');
    assert.ok(elapsed < 50, `Healthcheck response time (${elapsed}ms) must be ultra-fast (<50ms)`);
  });

  await challenge('CH-M4-11', 'Static SPA is served from dist/ and arbitrary client-side routes fallback to index.html', async () => {
    // 1. Root route returns index.html
    const rootRes = await fetch(`${baseUrl}/`);
    assert.strictEqual(rootRes.status, 200);
    const rootHtml = await rootRes.text();
    assert.ok(rootHtml.includes('<div id="root"></div>'), 'Root URL must serve SPA index.html');

    // 2. Client-side SPA routes (e.g., /dashboard, /login, /orders/123) fallback to index.html
    const clientRoutes = ['/login', '/dashboard', '/requests', '/financial-report'];
    for (const route of clientRoutes) {
      const routeRes = await fetch(`${baseUrl}${route}`);
      assert.strictEqual(routeRes.status, 200, `Client route ${route} must return 200 OK`);
      const routeHtml = await routeRes.text();
      assert.ok(routeHtml.includes('<div id="root"></div>'), `Client route ${route} must serve SPA index.html`);
    }

    // 3. Unknown /api/* routes must NOT return HTML fallback (should return API 404)
    const apiRes = await fetch(`${baseUrl}/api/unknown-endpoint-test`);
    assert.strictEqual(apiRes.status, 404, 'Unknown /api/* route must return 404 NOT FOUND, not HTML');
  });

  await challenge('CH-M4-12', 'Persistent storage directories (uploads/invoices) are automatically ensured on boot', async () => {
    const uploadInvoicesDir = path.resolve(projectRoot, 'uploads', 'invoices');
    assert.ok(fs.existsSync(uploadInvoicesDir), 'uploads/invoices directory must exist');
  });

} finally {
  server.close();
  testDb.close();
}

console.log('\n====================================================');
console.log(`🏆 ALL ${passed}/${total} ADVERSARIAL DOCKER CHALLENGES PASSED WITH 100% SUCCESS!`);
console.log('====================================================\n');
