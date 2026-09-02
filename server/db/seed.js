import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { db as defaultDb } from './database.js';
import { runMigrations } from './migrate.js';

const SALT_ROUNDS = 10;

/**
 * Standard official FSAE subsystems and recommended initial budget allocations.
 */
export const OFFICIAL_SUBSYSTEMS = [
  { name: 'Powertrain', code: 'POW', budget_allocated: 15000.0 },
  { name: 'Châssis', code: 'CHA', budget_allocated: 8000.0 },
  { name: 'Suspension', code: 'SUS', budget_allocated: 6000.0 },
  { name: 'Aérodynamique', code: 'AER', budget_allocated: 5000.0 },
  { name: 'Télémétrie', code: 'TEL', budget_allocated: 4000.0 },
  { name: 'Électronique Basse Tension', code: 'LVE', budget_allocated: 7000.0 }
];

/**
 * Inserts or updates the official FSAE subsystems.
 * @param {import('better-sqlite3').Database} targetDb
 */
export function seedSubsystems(targetDb) {
  const insertSubsystem = targetDb.prepare(`
    INSERT INTO subsystems (name, code, budget_allocated)
    VALUES (@name, @code, @budget_allocated)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      budget_allocated = excluded.budget_allocated
  `);

  for (const s of OFFICIAL_SUBSYSTEMS) {
    insertSubsystem.run(s);
  }

  const subMap = {};
  const allSubs = targetDb.prepare('SELECT id, code FROM subsystems').all();
  for (const sub of allSubs) {
    subMap[sub.code] = sub.id;
  }
  return subMap;
}

/**
 * Seeds the initial Admin user for bootstrapping the system.
 * @param {import('better-sqlite3').Database} targetDb
 * @param {string} [email]
 * @param {string} [password]
 * @param {string} [name]
 */
export function seedAdminUser(
  targetDb,
  email = process.env.ADMIN_EMAIL || 'admin@fsae.org',
  password = process.env.ADMIN_PASSWORD || 'admin123',
  name = process.env.ADMIN_NAME || 'FSAE Lead Admin'
) {
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  targetDb.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, 'Admin')
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      password_hash = excluded.password_hash,
      role = 'Admin'
  `).run(name, email, passwordHash);

  return targetDb.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(email);
}

/**
 * PROD SEED: Clean initialization for real FSAE competition operations.
 * - Seeds official Subsystems and allocated budgets.
 * - Creates initial Admin user to configure the team.
 * - ZERO fake part requests, ZERO fake orders, ZERO fake invoices.
 * @param {import('better-sqlite3').Database} [targetDb]
 * @returns {object} Summary of seeded entities.
 */
export function runProdSeed(targetDb = defaultDb) {
  runMigrations(targetDb);

  const prodTransaction = targetDb.transaction(() => {
    console.log('🏭 [SEED:PROD] Initialisation de la base PRODUCTION réelle...');

    const subMap = seedSubsystems(targetDb);
    const admin = seedAdminUser(targetDb);

    console.log('✅ [SEED:PROD] Base de production prête :');
    console.log(`  - Sous-systèmes officiels : ${OFFICIAL_SUBSYSTEMS.length}`);
    console.log(`  - Compte Admin initial : ${admin.email}`);
    console.log('  - Requêtes / Commandes : 0 (propre pour la vraie équipe)');

    return {
      mode: 'production',
      subsystemsCount: OFFICIAL_SUBSYSTEMS.length,
      usersCount: 1,
      partRequestsCount: 0,
      purchaseOrdersCount: 0,
      invoicesCount: 0
    };
  });

  return prodTransaction();
}

/**
 * DEMO / DEV SEED: Seeds realistic test dataset with various roles, part requests,
 * suppliers (DigiKey, Mouser, McMaster), urgency levels, and invoices.
 * @param {import('better-sqlite3').Database} [targetDb]
 * @returns {object} Summary of seeded entities.
 */
export function runDemoSeed(targetDb = defaultDb) {
  runMigrations(targetDb);

  const demoTransaction = targetDb.transaction(() => {
    console.log('🧪 [SEED:DEMO] Initialisation de la base DEV / DÉMONSTRATION...');

    // 1. Seed Demo Users (Member, Purchaser, Admin)
    const users = [
      {
        name: 'Alexandre Tremblay',
        email: 'member@fsae.org',
        password_hash: bcrypt.hashSync('member123', SALT_ROUNDS),
        role: 'Member'
      },
      {
        name: 'Sarah Dubois',
        email: 'purchaser@fsae.org',
        password_hash: bcrypt.hashSync('purchaser123', SALT_ROUNDS),
        role: 'Purchaser'
      },
      {
        name: 'Maxime Leclerc',
        email: 'admin@fsae.org',
        password_hash: bcrypt.hashSync('admin123', SALT_ROUNDS),
        role: 'Admin'
      }
    ];

    const insertUser = targetDb.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (@name, @email, @password_hash, @role)
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name,
        password_hash = excluded.password_hash,
        role = excluded.role
    `);

    for (const u of users) {
      insertUser.run(u);
    }

    const memberUser = targetDb.prepare('SELECT id FROM users WHERE email = ?').get('member@fsae.org');
    const purchaserUser = targetDb.prepare('SELECT id FROM users WHERE email = ?').get('purchaser@fsae.org');
    const adminUser = targetDb.prepare('SELECT id FROM users WHERE email = ?').get('admin@fsae.org');

    // 2. Seed Subsystems
    const subMap = seedSubsystems(targetDb);

    // 3. Clean and reseed demo child tables
    targetDb.prepare('DELETE FROM invoices').run();
    targetDb.prepare('DELETE FROM part_requests').run();

    // 4. Seed Purchase Orders
    const purchaseOrders = [
      {
        po_number: 'PO-2026-0001',
        supplier: 'DigiKey',
        status: 'ORDERED',
        purchaser_id: purchaserUser.id,
        total_cost: 342.50
      },
      {
        po_number: 'PO-2026-0002',
        supplier: 'McMaster-Carr',
        status: 'COMPLETED',
        purchaser_id: purchaserUser.id,
        total_cost: 185.20
      }
    ];

    const insertPO = targetDb.prepare(`
      INSERT INTO purchase_orders (po_number, supplier, status, purchaser_id, total_cost)
      VALUES (@po_number, @supplier, @status, @purchaser_id, @total_cost)
      ON CONFLICT(po_number) DO UPDATE SET
        supplier = excluded.supplier,
        status = excluded.status,
        purchaser_id = excluded.purchaser_id,
        total_cost = excluded.total_cost
    `);

    for (const po of purchaseOrders) {
      insertPO.run(po);
    }

    const po1 = targetDb.prepare('SELECT id FROM purchase_orders WHERE po_number = ?').get('PO-2026-0001');
    const po2 = targetDb.prepare('SELECT id FROM purchase_orders WHERE po_number = ?').get('PO-2026-0002');

    // 5. Seed Part Requests with varied urgency levels and statuses
    const partRequests = [
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['TEL'],
        supplier: 'DigiKey',
        sku: '3088061',
        url: 'https://www.digikey.com/en/products/detail/stmicroelectronics/STM32F407VGT6/3088061',
        description: 'Microcontrôleur STM32F407VGT6 Cortex-M4 pour ECU Télémétrie',
        quantity: 5,
        unit_price_est: 18.50,
        urgency_level: 'CRITICAL',
        status: 'ORDERED',
        po_id: po1.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['LVE'],
        supplier: 'DigiKey',
        sku: '277057',
        url: 'https://www.digikey.ca/en/products/detail/texas-instruments/NE555P/277057',
        description: 'Timer NE555P DIP-8 pour circuit de sécurité watchdog',
        quantity: 20,
        unit_price_est: 1.25,
        urgency_level: 'URGENT',
        status: 'ORDERED',
        po_id: po1.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['LVE'],
        supplier: 'DigiKey',
        sku: 'WM1784-ND',
        url: 'https://www.digikey.ca/en/products/detail/molex/0430450400/268974',
        description: 'Connecteurs Molex Micro-Fit 3.0 4-pins angle droit',
        quantity: 10,
        unit_price_est: 4.50,
        urgency_level: 'NORMAL',
        status: 'ORDERED',
        po_id: po1.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['SUS'],
        supplier: 'McMaster-Carr',
        sku: '91290A115',
        url: 'https://www.mcmaster.com/91290A115/',
        description: 'Vis à tête creuse M6x20mm Titane Grade 5 pour triangles de suspension',
        quantity: 10,
        unit_price_est: 12.80,
        urgency_level: 'CRITICAL',
        status: 'RECEIVED',
        po_id: po2.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['AER'],
        supplier: 'McMaster-Carr',
        sku: '6544K23',
        url: 'https://www.mcmaster.com/products/6544K23/',
        description: 'Tissu Carbone Pré-imprégné 3K Twill 200g/m² pour aileron avant',
        quantity: 1,
        unit_price_est: 57.20,
        urgency_level: 'NORMAL',
        status: 'RECEIVED',
        po_id: po2.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['POW'],
        supplier: 'DigiKey',
        sku: '255-1234-ND',
        url: 'https://www.digikey.com/en/products/detail/panasonic/EVR100/12345',
        description: 'Contacteur haute tension 450V 200A pour pack batterie tractif',
        quantity: 2,
        unit_price_est: 120.00,
        urgency_level: 'URGENT',
        status: 'SUBMITTED',
        po_id: null
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['CHA'],
        supplier: 'McMaster-Carr',
        sku: '89955K22',
        url: 'https://www.mcmaster.com/89955K22/',
        description: 'Tube Acier Chromoly 4130 1.0" OD x 0.095" Wall pour arceau principal',
        quantity: 4,
        unit_price_est: 45.00,
        urgency_level: 'NORMAL',
        status: 'SUBMITTED',
        po_id: null
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['TEL'],
        supplier: 'DigiKey',
        sku: 'CABLE-TEST-01',
        url: 'https://www.digikey.com/en/products/detail/digi/XBEE-ANT/999',
        description: 'Antenne SMA 2.4GHz pour module télémétrie sans-fil',
        quantity: 2,
        unit_price_est: 15.00,
        urgency_level: 'NORMAL',
        status: 'DRAFT',
        po_id: null
      }
    ];

    const insertRequest = targetDb.prepare(`
      INSERT INTO part_requests (requester_id, subsystem_id, supplier, sku, url, description, quantity, unit_price_est, urgency_level, status, po_id)
      VALUES (@requester_id, @subsystem_id, @supplier, @sku, @url, @description, @quantity, @unit_price_est, @urgency_level, @status, @po_id)
    `);

    for (const pr of partRequests) {
      insertRequest.run(pr);
    }

    // 6. Seed Invoices
    const invoices = [
      {
        po_id: po1.id,
        file_name: 'INV-2026-0001.pdf',
        file_path: 'uploads/invoices/INV-2026-0001.pdf',
        amount: 342.50
      },
      {
        po_id: po2.id,
        file_name: 'INV-2026-0002.pdf',
        file_path: 'uploads/invoices/INV-2026-0002.pdf',
        amount: 185.20
      }
    ];

    const insertInvoice = targetDb.prepare(`
      INSERT INTO invoices (po_id, file_name, file_path, amount)
      VALUES (@po_id, @file_name, @file_path, @amount)
    `);

    for (const inv of invoices) {
      insertInvoice.run(inv);
    }

    console.log('✅ [SEED:DEMO] Données de démonstration chargées :');
    console.log(`  - Utilisateurs : ${users.length} (member, purchaser, admin)`);
    console.log(`  - Sous-systèmes : ${OFFICIAL_SUBSYSTEMS.length}`);
    console.log(`  - Commandes (PO) : ${purchaseOrders.length}`);
    console.log(`  - Requêtes de pièces : ${partRequests.length}`);
    console.log(`  - Factures : ${invoices.length}`);

    return {
      mode: 'demo',
      usersCount: users.length,
      subsystemsCount: OFFICIAL_SUBSYSTEMS.length,
      purchaseOrdersCount: purchaseOrders.length,
      partRequestsCount: partRequests.length,
      invoicesCount: invoices.length
    };
  });

  return demoTransaction();
}

/**
 * Universal runSeed function (backward compatible with tests and automation).
 * Defaults to demo seed unless mode is explicitly 'prod' or 'production'.
 * @param {import('better-sqlite3').Database} [targetDb]
 * @param {string} [mode] - 'demo' | 'prod' | 'production'
 */
export function runSeed(targetDb = defaultDb, mode = process.env.SEED_MODE || process.env.NODE_ENV || 'demo') {
  if (mode === 'prod' || mode === 'production') {
    return runProdSeed(targetDb);
  }
  return runDemoSeed(targetDb);
}

// CLI Execution Support
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const isProdArg = process.argv.includes('--prod') || 
                      process.argv.includes('--mode=prod') || 
                      process.env.NODE_ENV === 'production';
    if (isProdArg) {
      runProdSeed();
    } else {
      runDemoSeed();
    }
    process.exit(0);
  } catch (err) {
    console.error('[SEED] Seeding failed:', err);
    process.exit(1);
  }
}
