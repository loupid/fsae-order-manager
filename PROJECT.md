# Project: FSAE Order Manager

## Architecture
- **Target Platform**: Raspberry Pi (ARM64 / ARMv7) & Linux/WSL.
- **Backend API**: Node.js 20 (Express ESM), lightweight in-process SQLite with Write-Ahead Logging (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`), `bcryptjs` (pure JS, 100% ARM portable), `jsonwebtoken` for stateless auth, `multer` with PDF MIME validation for invoice uploads, and native async `fetch` for Discord Webhook alerts.
- **Frontend SPA**: React 19, Vite, Tailwind CSS, Lucide Icons, client-side regex parsing for instant URL auto-fill.
- **Packaging & Deployment**: Multi-stage Dockerfile (`linux/arm64`, `linux/arm/v7`) serving both Express API and static Vite bundle, orchestrated via `docker-compose.yml` with persistent host volumes (`./data` for SQLite, `./uploads` for PDF invoices). Total memory footprint < 60MB RAM.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Users Schema & Hashing | Relational table `Users` with unique email and `bcryptjs` hashed passwords | M1 | ORIGINAL_REQUEST R1 |
| 2 | Subsystems Schema & Budgets | Relational table `Subsystems` (`name`, `code`, `budget_allocated`) | M1 | ORIGINAL_REQUEST R1 |
| 3 | PartRequests Schema & Urgency | Relational table `PartRequests` with FKs, `urgency_level` (`NORMAL`, `URGENT`, `CRITICAL`), `status` | M1 | ORIGINAL_REQUEST R1 |
| 4 | PurchaseOrders Schema & Grouping | Relational table `PurchaseOrders` with unique `po_number`, `supplier`, `purchaser_id`, `status` | M1 | ORIGINAL_REQUEST R1 |
| 5 | Invoices Schema & PO Link | Relational table `Invoices` linking PDF file paths to `po_id` | M1 | ORIGINAL_REQUEST R1 |
| 6 | Migrations & Seed Scripts | SQLite WAL initialization, foreign key pragma, and demo seed data (Member, Purchaser, Admin) | M1 | ORIGINAL_REQUEST R1 |
| 7 | JWT Authentication API | Stateless JWT token issuance (`/api/auth/login`, `/register`, `/me`) | M2 | ORIGINAL_REQUEST R2 |
| 8 | RBAC Security Middleware | Role-Based Access Control enforcing `Member`, `Purchaser`, `Admin` permissions | M2 | ORIGINAL_REQUEST R2 |
| 9 | Part Requests CRUD API | Endpoints to submit, view, filter (by subsystem/urgency/requester), and update requests | M2 | ORIGINAL_REQUEST R2 |
| 10 | Purchase Orders Aggregation API | 1-Click grouping of approved requests by supplier into POs and status lifecycle management | M2 | ORIGINAL_REQUEST R2 |
| 11 | PDF Invoice Upload & Serve API | Multer multipart PDF upload with MIME magic-byte validation and secure file streaming | M2 | ORIGINAL_REQUEST R2 |
| 12 | Subsystem Spend & Budget API | Aggregation of allocated vs committed vs actual spend per vehicle subsystem | M2 | ORIGINAL_REQUEST R2 |
| 13 | DigiKey URL Regex Parser | Regex extractor for DigiKey Part Number/SKU from URLs without scraping | M2 | ORIGINAL_REQUEST R2 |
| 14 | Mouser URL Regex Parser | Regex extractor for Mouser Part Number/Manufacturer from URLs without scraping | M2 | ORIGINAL_REQUEST R2 |
| 15 | McMaster-Carr URL Regex Parser | Regex extractor for McMaster catalog IDs from URLs without scraping | M2 | ORIGINAL_REQUEST R2 |
| 16 | Assisted Vendor Fallback | Graceful fallback extracting domain name and prompting manual SKU verification | M2 | ORIGINAL_REQUEST R2 |
| 17 | Discord Webhook PO Alert | Asynchronous Rich Embed notification on PO creation (supplier, purchaser, urgency, cost) | M2 | ORIGINAL_REQUEST R3 |
| 18 | Discord Webhook Arrival Alert | Asynchronous Rich Embed notification when parts arrive for a subsystem | M2 | ORIGINAL_REQUEST R3 |
| 19 | Discord Resilient Error Catch | Non-blocking try/catch ensuring Discord outages never fail backend transactions | M2 | ORIGINAL_REQUEST R3 |
| 20 | React 19 Auth & Session UI | Login and registration views with JWT storage and role-aware navigation | M3 | ORIGINAL_REQUEST R4 |
| 21 | Smart Request Form Component | Component with live client-side URL regex auto-detection, subsystem selector, and urgency badge | M3 | ORIGINAL_REQUEST R4 |
| 22 | Member Tracking Funnel View | Kanban/pipeline view tracking member parts (`SUBMITTED` -> `ORDERED` -> `RECEIVED`) | M3 | ORIGINAL_REQUEST R4 |
| 23 | Purchaser Grouping Dashboard | Interface grouping pending requests by vendor, generating POs in 1-click, managing statuses | M3 | ORIGINAL_REQUEST R4 |
| 24 | PDF Invoice Upload & Viewer UI | Modal to drag-and-drop PDF invoices and download/view stored receipts | M3 | ORIGINAL_REQUEST R4 |
| 25 | Subsystem Cost Report View | Visual breakdown of expenses vs budgets per subsystem with over-budget alerts | M3 | ORIGINAL_REQUEST R4 |
| 26 | Multi-vendor CSV Export Modal | Export PO items to DigiKey, Mouser, LCSC, or generic CSV formats | M3 | Existing component |
| 27 | Multi-Stage ARM Dockerfile | Minimal Node 20 Alpine multi-stage container building Vite frontend and running Express backend | M4 | ORIGINAL_REQUEST R5 |
| 28 | Persistent Docker Compose | `docker-compose.yml` with persistent volume bindings for `./data` and `./uploads` | M4 | ORIGINAL_REQUEST R5 |
| 29 | Tier 1-4 Automated Test Suite | Automated test runner in WSL Ubuntu (`npm test`) covering schema, auth, parsers, API, E2E | M5 | ORIGINAL_REQUEST Verification |
| 30 | Concurrency & Outage Stress Tests | Verification of 50 concurrent SQLite writes in WAL mode and Discord mock outage handling | M5 | Technical Strategy |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Database & Data Models | SQLite WAL database initialization, table schemas (`users`, `subsystems`, `part_requests`, `purchase_orders`, `invoices`), FK constraints, `bcryptjs` hashing, migrations, and seed scripts | None | DONE |
| 2 | Backend API, Parsers & Discord | Express server, JWT auth, RBAC middleware, Part Requests CRUD, PO aggregation & lifecycle, PDF invoice upload/serve with MIME validation, vendor regex extractors (DigiKey, Mouser, McMaster), Discord Webhook Rich Embeds | M1 | DONE |
| 3 | React 19 Frontend Web Interface | React 19 + Vite + Tailwind UI, Auth views, live URL regex request form, Member funnel view, Purchaser dashboard, PDF invoice viewer, Subsystems cost report view | M2 | DONE |
| 4 | ARM Docker & Deployment | Multi-stage ARM Dockerfile (`linux/arm64`, `linux/arm/v7`), `docker-compose.yml` with persistent volumes (`./data`, `./uploads`) | M2, M3 | DONE |
| 5 | Comprehensive Automated E2E Testing | Automated test suite (`npm test` in Ubuntu WSL) covering Tiers 1-4 + Tier 5 adversarial verification, `TEST_READY.md` publication | M1, M2, M3, M4 | DONE |

---

## Interface Contracts

### 1. Database Entities (`server/db/schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('Member', 'Purchaser', 'Admin')) NOT NULL DEFAULT 'Member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subsystems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    budget_allocated REAL NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT UNIQUE NOT NULL,
    supplier TEXT NOT NULL,
    status TEXT CHECK(status IN ('PENDING', 'ORDERED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED')) NOT NULL DEFAULT 'PENDING',
    purchaser_id INTEGER NOT NULL REFERENCES users(id),
    total_cost REAL NOT NULL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS part_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    subsystem_id INTEGER NOT NULL REFERENCES subsystems(id),
    supplier TEXT NOT NULL,
    sku TEXT NOT NULL,
    url TEXT,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_est REAL NOT NULL DEFAULT 0.0,
    urgency_level TEXT CHECK(urgency_level IN ('NORMAL', 'URGENT', 'CRITICAL')) NOT NULL DEFAULT 'NORMAL',
    status TEXT CHECK(status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'REJECTED')) NOT NULL DEFAULT 'SUBMITTED',
    po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    amount REAL NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. REST API Endpoints
- `POST /api/auth/register` -> `{ name, email, password, role? }` -> `201 { token, user }`
- `POST /api/auth/login` -> `{ email, password }` -> `200 { token, user }`
- `GET /api/auth/me` -> Bearer token -> `200 { user }`
- `GET /api/subsystems` -> `200 [ { id, name, code, budget_allocated, committed_cost, actual_cost, remaining_budget } ]`
- `POST /api/subsystems` (Admin) -> `{ name, code, budget_allocated }` -> `201 Subsystem`
- `GET /api/part-requests` -> Query: `subsystem_id`, `urgency_level`, `status`, `requester_id` -> `200 [ PartRequest ]`
- `POST /api/part-requests` -> `{ subsystem_id, supplier, sku, url, description, quantity, unit_price_est, urgency_level }` -> `201 PartRequest`
- `PATCH /api/part-requests/:id/status` (Purchaser/Admin) -> `{ status }` -> `200 PartRequest`
- `DELETE /api/part-requests/:id` (Owner/Admin) -> `200 { success: true }`
- `GET /api/purchase-orders` -> `200 [ PurchaseOrder with items and invoices ]`
- `POST /api/purchase-orders` (Purchaser/Admin) -> `{ supplier, request_ids }` -> `201 PurchaseOrder`
- `PATCH /api/purchase-orders/:id/status` (Purchaser/Admin) -> `{ status }` -> `200 PurchaseOrder`
- `POST /api/purchase-orders/:id/invoices` (Purchaser/Admin) -> Multipart `file` (PDF) + `amount` -> `201 Invoice`
- `GET /api/invoices/:id/download` -> Bearer token -> Streams PDF file
- `POST /api/parsers/parse-url` -> `{ url }` -> `200 { supplier, sku, mpn, manufacturer, recognized }`

---

## Code Layout
```
d:/Project/AI_Project/FSAE_OrderManager/
├── server/
│   ├── index.js                  # Main Express server entry point (API + static SPA)
│   ├── db/
│   │   ├── database.js           # SQLite connection & WAL pragma configuration
│   │   ├── schema.sql            # Table definitions, constraints, indexes
│   │   ├── migrate.js            # Migration execution runner
│   │   └── seed.js               # Initial seed script with demo users & subsystems
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & RBAC role guards
│   │   └── upload.js             # Multer PDF file filter with MIME validation
│   ├── routes/
│   │   ├── auth.routes.js        # /api/auth
│   │   ├── subsystems.routes.js  # /api/subsystems & cost reporting
│   │   ├── requests.routes.js    # /api/part-requests
│   │   ├── orders.routes.js      # /api/purchase-orders
│   │   ├── invoices.routes.js    # /api/invoices
│   │   └── parsers.routes.js     # /api/parsers
│   ├── services/
│   │   ├── parsers/
│   │   │   └── vendorParser.js   # DigiKey, Mouser, McMaster regex extractors
│   │   └── discord/
│   │       └── discordWebhook.js # Rich Embed generator & non-blocking dispatcher
│   └── tests/
│       ├── test_runner.js        # Main comprehensive automated test runner (Tiers 1-4)
│       ├── schema.test.js        # SQLite constraints, FKs, seeds, bcrypt
│       ├── parsers.test.js       # Vendor URL regex extraction edge cases
│       ├── auth_rbac.test.js     # JWT issuance, Member vs Purchaser vs Admin RBAC
│       ├── api_lifecycle.test.js # E2E workflow: Request -> PO -> Invoice -> Reception
│       └── discord_stress.test.js# Concurrency writes & Discord outage resilience
├── src/
│   ├── main.jsx                  # React 19 root entry point
│   ├── App.jsx                   # Root application container & navigation
│   ├── api/
│   │   └── client.js             # Fetch wrapper with JWT headers and error handling
│   ├── context/
│   │   └── AuthContext.jsx       # Auth state provider (login, logout, current user)
│   ├── components/
│   │   ├── Navbar.jsx            # Header with role badge and user profile
│   │   ├── PartRequestModal.jsx  # New part request with real-time URL parser
│   │   ├── UrgencyBadge.jsx      # Visual badges for NORMAL, URGENT, CRITICAL
│   │   ├── InvoiceUploadModal.jsx# PDF upload modal
│   │   └── CsvExportModal.jsx    # CSV export modal
│   ├── views/
│   │   ├── LoginView.jsx         # Login & Register views
│   │   ├── MemberFunnelView.jsx  # Tracking funnel for member parts
│   │   ├── PurchaserDashboard.jsx# Grouping requests by supplier & PO generation
│   │   └── CostReportView.jsx    # Subsystems spend vs budget metrics
│   └── index.css                 # Dark FSAE theme styles & utility classes
├── data/                         # Persistent host mount for SQLite DB
├── uploads/                      # Persistent host mount for PDF invoices
├── Dockerfile                    # Multi-stage ARM-compatible build
├── docker-compose.yml            # Persistent volume & network orchestration
└── package.json                  # Dependencies & scripts
```
