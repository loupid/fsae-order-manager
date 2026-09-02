/**
 * Master Test Runner for FSAE Order Manager (Tiers 1 - 5)
 */
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAllTests() {
  console.log('====================================================');
  console.log('🏎️  FSAE ORDER MANAGER AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  try {
    console.log('👉 [TIER 1] Running Database Schema & Seed Tests...');
    await import('./schema.test.js');
    console.log('\n✨ Tier 1 Baseline Tests Completed Successfully.\n');

    console.log('👉 [TIER 1-ADV] Running Database Adversarial Stress Tests...');
    await import('./adversarial_m1.test.js');
    console.log('\n✨ Tier 1 Adversarial Tests Completed Successfully.\n');

    console.log('👉 [TIER 1-ADV2] Running Challenger 2 Adversarial Stress Tests...');
    await import('./adversarial_challenger2.test.js');
    console.log('\n✨ Challenger 2 Adversarial Tests Completed Successfully.\n');

    console.log('👉 [TIER 2-PARSERS] Running Vendor URL Parser Test Suite...');
    await import('./parsers.test.js');
    console.log('\n✨ Tier 2 Vendor URL Parser Tests Completed Successfully.\n');

    console.log('👉 [TIER 2-API] Running Milestone 2 REST API Integration Tests...');
    await import('./m2_api.test.js');
    console.log('\n✨ Tier 2 REST API Integration Tests Completed Successfully.\n');

    console.log('👉 [TIER 2-ADV] Running Milestone 2 Challenger Adversarial Stress Tests...');
    await import('./adversarial_m2_challenger.test.js');
    console.log('\n✨ Tier 2 Challenger Adversarial Tests Completed Successfully.\n');

    console.log('👉 [TIER 3 & 4] Running Frontend, Docker & E2E Integration Tests...');
    await import('./m3_m4_integration.test.js');
    console.log('\n✨ Tier 3 & 4 E2E & Deployment Tests Completed Successfully.\n');

    console.log('👉 [TIER 3-ADV] Running Milestone 3 Challenger Adversarial Stress Tests...');
    await import('./adversarial_m3_challenger.test.js');
    console.log('\n✨ Tier 3 Challenger Adversarial Tests Completed Successfully.\n');

    console.log('👉 [TIER 4-ADV] Running Milestone 4 Docker Challenger Stress Tests...');
    await import('./adversarial_m4_challenger.test.js');
    console.log('\n✨ Tier 4 Challenger Adversarial Tests Completed Successfully.\n');

    console.log('====================================================');
    console.log('🏆 ALL TEST SUITES PASSED WITH 100% SUCCESS!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Test Suite Failed:', err);
    process.exit(1);
  }
}

runAllTests();
