import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { db as defaultDb } from './database.js';
import { runMigrations } from './migrate.js';

const SALT_ROUNDS = 10;

/**
 * Official Formule SAE UQTR subsystems and initial recommended budget allocations.
 */
export const OFFICIAL_SUBSYSTEMS = [
  { name: 'Team Électrique', code: 'ELE', budget_allocated: 15000.0 },
  { name: 'Team Structure', code: 'STR', budget_allocated: 8000.0 },
  { name: 'Team Drivetrain', code: 'DRI', budget_allocated: 10000.0 },
  { name: 'Team Ergonomique', code: 'ERG', budget_allocated: 4000.0 },
  { name: 'Team Admin', code: 'ADM', budget_allocated: 5000.0 }
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
  // Backward compatibility aliases for legacy test suites
  if (subMap['ELE']) {
    subMap['POW'] = subMap['ELE'];
    subMap['TEL'] = subMap['ELE'];
    subMap['LVE'] = subMap['ELE'];
  }
  if (subMap['STR']) {
    subMap['CHA'] = subMap['STR'];
    subMap['AER'] = subMap['STR'];
  }
  if (subMap['DRI']) {
    subMap['SUS'] = subMap['DRI'];
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
  name = process.env.ADMIN_NAME || 'William (loupid) — Lead Techno & ECU'
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
        role: 'Member',
        department: 'ELE',
        subsystem: 'Accumulateur & BMS',
        discord_handle: 'alex_elec'
      },
      {
        name: 'Sarah Dubois',
        email: 'purchaser@fsae.org',
        password_hash: bcrypt.hashSync('purchaser123', SALT_ROUNDS),
        role: 'Purchaser',
        department: 'ADM',
        subsystem: 'Finances & Achats',
        discord_handle: 'sarah_fsae'
      },
      {
        name: 'William (loupid) — Lead Techno & ECU',
        email: 'admin@fsae.org',
        password_hash: bcrypt.hashSync('admin123', SALT_ROUNDS),
        role: 'Admin',
        department: 'ELE',
        subsystem: 'Télémétrie & ECU',
        discord_handle: 'loupid'
      }
    ];

    const insertUser = targetDb.prepare(`
      INSERT INTO users (name, email, password_hash, role, department, subsystem, discord_handle)
      VALUES (@name, @email, @password_hash, @role, @department, @subsystem, @discord_handle)
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name,
        password_hash = excluded.password_hash,
        role = excluded.role,
        department = excluded.department,
        subsystem = excluded.subsystem,
        discord_handle = excluded.discord_handle
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

    // 5. Seed Part Requests with varied urgency levels and statuses for UQTR Teams
    const partRequests = [
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['ELE'],
        supplier: 'DigiKey',
        sku: '3088061',
        url: 'https://www.digikey.ca/en/products/detail/stmicroelectronics/STM32F407VGT6/3088061',
        description: 'Microcontrôleur STM32F407VGT6 Cortex-M4 pour ECU & Télémétrie',
        quantity: 5,
        unit_price_est: 18.50,
        urgency_level: 'CRITICAL',
        status: 'ORDERED',
        po_id: po1.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['ELE'],
        supplier: 'JLCPCB',
        sku: 'C2040',
        url: 'https://jlcpcb.com/parts/componentSearch?searchTxt=C2040',
        description: 'Circuits imprimés PCB 4-couches pour carte acquisition CAN & Télémétrie',
        quantity: 10,
        unit_price_est: 6.20,
        urgency_level: 'CRITICAL',
        status: 'ORDERED',
        po_id: po1.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['ELE'],
        supplier: 'LCSC',
        sku: 'C12084',
        url: 'https://www.lcsc.com/product-detail/CAN-ICs_TI-SN65HVD230DR_C12084.html',
        description: 'Transceivers CAN Bus 3.3V SN65HVD230DR pour bus communication char',
        quantity: 15,
        unit_price_est: 1.45,
        urgency_level: 'URGENT',
        status: 'ORDERED',
        po_id: po1.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['DRI'],
        supplier: 'McMaster-Carr',
        sku: '91290A115',
        url: 'https://www.mcmaster.com/91290A115/',
        description: 'Vis à tête creuse M6x20mm Titane Grade 5 pour moyeux et transmission',
        quantity: 10,
        unit_price_est: 12.80,
        urgency_level: 'CRITICAL',
        status: 'RECEIVED',
        po_id: po2.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['STR'],
        supplier: 'McMaster-Carr',
        sku: '6544K23',
        url: 'https://www.mcmaster.com/products/6544K23/',
        description: 'Tissu Carbone Pré-imprégné 3K Twill 200g/m² pour structure monocoque',
        quantity: 1,
        unit_price_est: 57.20,
        urgency_level: 'NORMAL',
        status: 'RECEIVED',
        po_id: po2.id
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['ELE'],
        supplier: 'DigiKey',
        sku: '255-1234-ND',
        url: 'https://www.digikey.ca/en/products/detail/panasonic/EVR100/12345',
        description: 'Contacteur haute tension 450V 200A pour pack accumulateur tractif',
        quantity: 2,
        unit_price_est: 120.00,
        urgency_level: 'URGENT',
        status: 'SUBMITTED',
        po_id: null
      },
      {
        requester_id: memberUser.id,
        subsystem_id: subMap['STR'],
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
        subsystem_id: subMap['ERG'],
        supplier: 'DigiKey',
        sku: 'SWITCH-EMERG-01',
        url: 'https://www.digikey.ca/en/products/detail/e-switch/RP8100/123',
        description: 'Bouton coupure arrêt d urgence habitacle pilote (Scrutineering EV)',
        quantity: 1,
        unit_price_est: 28.50,
        urgency_level: 'CRITICAL',
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
