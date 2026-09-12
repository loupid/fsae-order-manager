-- FSAE Order Manager — Relational Database Schema
-- Optimized for SQLite 3.x with WAL mode and Foreign Key enforcement

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('Member', 'Purchaser', 'Admin')) NOT NULL DEFAULT 'Member',
    department TEXT,
    subsystem TEXT,
    discord_handle TEXT,
    tshirt_size TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. SUBSYSTEMS TABLE
CREATE TABLE IF NOT EXISTS subsystems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    budget_allocated REAL NOT NULL DEFAULT 0.0 CHECK(budget_allocated >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. PURCHASE ORDERS TABLE
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT UNIQUE NOT NULL,
    supplier TEXT NOT NULL,
    status TEXT CHECK(status IN ('PENDING', 'ORDERED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED')) NOT NULL DEFAULT 'PENDING',
    purchaser_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_cost REAL NOT NULL DEFAULT 0.0 CHECK(total_cost >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. PART REQUESTS TABLE
CREATE TABLE IF NOT EXISTS part_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    subsystem_id INTEGER NOT NULL REFERENCES subsystems(id) ON DELETE RESTRICT,
    supplier TEXT NOT NULL,
    sku TEXT NOT NULL,
    url TEXT,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    unit_price_est REAL NOT NULL DEFAULT 0.0 CHECK(unit_price_est >= 0),
    urgency_level TEXT CHECK(urgency_level IN ('NORMAL', 'URGENT', 'CRITICAL')) NOT NULL DEFAULT 'NORMAL',
    status TEXT CHECK(status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'REJECTED')) NOT NULL DEFAULT 'SUBMITTED',
    po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount >= 0),
    upload_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_subsystems_code ON subsystems(code);
CREATE INDEX IF NOT EXISTS idx_part_requests_requester ON part_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_part_requests_subsystem ON part_requests(subsystem_id);
CREATE INDEX IF NOT EXISTS idx_part_requests_po ON part_requests(po_id);
CREATE INDEX IF NOT EXISTS idx_part_requests_status ON part_requests(status);
CREATE INDEX IF NOT EXISTS idx_part_requests_urgency ON part_requests(urgency_level);
CREATE INDEX IF NOT EXISTS idx_part_requests_supplier ON part_requests(supplier);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_purchaser ON purchase_orders(purchaser_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_invoices_po_id ON invoices(po_id);
