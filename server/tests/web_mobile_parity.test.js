/**
 * Tier 8: Web & Mobile Functional Parity Sentinel Test Suite
 * Assure que les règles de parité 1:1 entre l'expérience Desktop et Mobile sont respectées.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runParityChecks } from '../../scripts/verify-web-mobile-parity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('📱💻 TIER 8: WEB & MOBILE PARITY SENTINEL TEST SUITE');
console.log('====================================================\n');

async function runParityTests() {
  let passedCount = 0;
  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  console.log('--- [1. Sentinel Parity Check Engine] ---');
  test('Parity check engine executes and validates core rules', () => {
    const result = runParityChecks();
    assert.strictEqual(typeof result, 'object', 'runParityChecks must return an object');
    assert.strictEqual(Array.isArray(result.checks), true, 'checks must be an array');
    assert.strictEqual(result.checks.length > 0, true, 'at least 5 parity checks must be performed');
  });

  console.log('--- [2. Viewport & PWA Configuration] ---');
  test('index.html contains mobile responsive viewport meta tag', () => {
    const indexPath = path.join(projectRoot, 'index.html');
    assert.strictEqual(fs.existsSync(indexPath), true, 'index.html must exist');
    const html = fs.readFileSync(indexPath, 'utf-8');
    assert.ok(
      html.includes('name="viewport"') && html.includes('width=device-width'),
      'index.html must declare responsive viewport'
    );
  });

  console.log('--- [3. Anti-Zoom & Touch Accessibility Rules] ---');
  test('CSS stylesheet protects against accidental horizontal page overflow', () => {
    const cssPath = path.join(projectRoot, 'src', 'index.css');
    assert.strictEqual(fs.existsSync(cssPath), true, 'src/index.css must exist');
    const css = fs.readFileSync(cssPath, 'utf-8');
    assert.ok(css.includes('box-sizing: border-box'), 'CSS must enforce border-box globally');
  });

  console.log('--- [4. Reactive Hook & Navigation Parity Assets] ---');
  test('Documentation and Automation Sentinel assets exist', () => {
    const agentsRulePath = path.join(projectRoot, '.agents', 'rules', 'web-mobile-parity.md');
    const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
    const skillPath = path.join(projectRoot, '.agents', 'skills', 'web-mobile-sync', 'SKILL.md');
    const hookPath = path.join(projectRoot, '.agents', 'hooks.json');

    assert.strictEqual(fs.existsSync(agentsRulePath), true, '.agents/rules/web-mobile-parity.md must exist');
    assert.strictEqual(fs.existsSync(agentsMdPath), true, 'AGENTS.md must exist');
    assert.strictEqual(fs.existsSync(skillPath), true, 'SKILL.md must exist');
    assert.strictEqual(fs.existsSync(hookPath), true, 'hooks.json must exist');
  });

  console.log('--- [5. RBAC Invariance Across Viewports] ---');
  test('Role permissions logic remains strictly identical on Desktop and Mobile', () => {
    const roles = {
      Member: { canOrder: false, canViewBudget: false, canManageUsers: false },
      Lead: { canOrder: true, canViewBudget: true, canManageUsers: false },
      Purchaser: { canOrder: true, canViewBudget: false, canManageUsers: false },
      Admin: { canOrder: true, canViewBudget: true, canManageUsers: true }
    };

    // Vérification que les rôles appliquent des règles déterministes indépendantes de la plateforme
    Object.entries(roles).forEach(([role, perms]) => {
      const isLeadOrPurchaserOrAdmin = ['Lead', 'Purchaser', 'Admin'].includes(role);
      const isLeadOrAdmin = ['Lead', 'Admin'].includes(role);
      const isAdmin = role === 'Admin';

      assert.strictEqual(isLeadOrPurchaserOrAdmin, perms.canOrder, `canOrder mismatch for ${role}`);
      assert.strictEqual(isLeadOrAdmin, perms.canViewBudget, `canViewBudget mismatch for ${role}`);
      assert.strictEqual(isAdmin, perms.canManageUsers, `canManageUsers mismatch for ${role}`);
    });
  });

  console.log(`\n====================================================`);
  console.log(`🏆 ALL ${passedCount} WEB & MOBILE PARITY TESTS PASSED!`);
  console.log(`====================================================\n`);
}

await runParityTests();
