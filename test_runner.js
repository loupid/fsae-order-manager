// Standalone Node.js Test Runner for Simplified FSAE Order Manager
// 1. Polyfill browser APIs
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

global.window = {
  location: {
    reload: () => console.log("[TEST] window.location.reload() called")
  }
};

// 2. Load .env variables dynamically for testing
import fs from 'fs';
import path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.log("[TEST] .env file not found or unreadable, running in LocalStorage mode");
}

global.import = {
  meta: {
    env: process.env
  }
};

// 2. Dynamic import to ensure polyfills are set up before module evaluation
const { api } = await import('./src/db.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=== STARTING REBUILT KANBAN INTEGRATION TESTS ===\n");

  try {
    // 1. Test Part Creation
    const part1 = await api.savePart({
      mpn: "TEST-MCU-100",
      sku: "TEST-SKU-100",
      distributor: "DigiKey",
      description: "Test Microcontroller",
      stock: 0,
      price: 15.50
    });
    
    assert(part1.id !== undefined, "Nouveau composant créé et assigné d'un ID");
    
    const partsList = await api.getParts();
    assert(partsList.length === 1, "Le catalogue contient exactement 1 pièce");
    assert(partsList[0].mpn === "TEST-MCU-100", "Le MPN de la pièce créée est exact");

    // 2. Test Order Creation (Draft state)
    const order1 = await api.saveOrder({
      distributor: "DigiKey",
      status: "Draft",
      submittedBy: "TestRunner",
      items: [
        { partId: part1.id, quantity: 10, price: 15.50 }
      ]
    });

    assert(order1.id !== undefined, "Nouvelle commande créée et assignée d'un ID");
    assert(order1.stockApplied !== true, "L'état Brouillon n'applique pas les stocks");

    // Verify stock is still 0
    let partsCheck = await api.getParts();
    assert(partsCheck[0].stock === 0, "Le stock est inchangé (attendu: 0)");

    // 3. Transition Order to Received
    order1.status = "Received";
    const orderReceived = await api.saveOrder(order1);

    // Verify stock is updated to 10
    partsCheck = await api.getParts();
    assert(partsCheck[0].stock === 10, "Le stock a été mis à jour automatiquement (attendu: 10, obtenu: " + partsCheck[0].stock + ")");
    assert(orderReceived.stockApplied === true, "La commande indique que son stock a été appliqué");

    // 4. Transition Order BACK to Ordered (simulating user dragging card back)
    orderReceived.status = "Ordered";
    const orderOrdered = await api.saveOrder(orderReceived);

    // Verify stock decreases back to 0
    partsCheck = await api.getParts();
    assert(partsCheck[0].stock === 0, "Le stock a été décrémenté automatiquement (attendu: 0, obtenu: " + partsCheck[0].stock + ")");
    assert(orderOrdered.stockApplied === false, "La commande indique que son stock n'est plus appliqué");

    // 5. Delete order while received (should keep stock clean)
    orderOrdered.status = "Received";
    const orderReceived2 = await api.saveOrder(orderOrdered); // stock back to 10
    
    await api.deleteOrder(order1.id);
    partsCheck = await api.getParts();
    assert(partsCheck[0].stock === 0, "Le stock a été nettoyé après suppression de la commande reçue (attendu: 0)");

    console.log(`\n=== BILAN DES TESTS ===`);
    console.log(`Total Réussis: ${passed}`);
    console.log(`Total Échoués: ${failed}`);
    
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error("Une erreur inattendue est survenue pendant les tests:", error);
    process.exit(1);
  }
}

runTests();
