import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { db, initDatabase, getDbPath } from './db/database.js';
import { runMigrations } from './db/migrate.js';
import { runProdSeed, runDemoSeed } from './db/seed.js';

import { createAuthRouter } from './routes/auth.routes.js';
import { createSubsystemsRouter } from './routes/subsystems.routes.js';
import { createRequestsRouter } from './routes/requests.routes.js';
import { createOrdersRouter } from './routes/orders.routes.js';
import { createInvoicesRouter } from './routes/invoices.routes.js';
import { createParsersRouter } from './routes/parsers.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and configures Express application instance.
 * @param {import('better-sqlite3').Database} [targetDb]
 * @param {string} [customWebhookUrl]
 * @returns {express.Application}
 */
export function createApp(targetDb = db, customWebhookUrl) {
  const app = express();

  // Ensure persistent directories exist
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'invoices');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes Mounting
  app.use('/api/auth', createAuthRouter(targetDb));
  app.use('/api/subsystems', createSubsystemsRouter(targetDb));
  app.use('/api/part-requests', createRequestsRouter(targetDb));
  app.use('/api/purchase-orders', createOrdersRouter(targetDb, customWebhookUrl));
  app.use('/api/invoices', createInvoicesRouter(targetDb));
  app.use('/api/parsers', createParsersRouter());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve static frontend in production
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error'
    });
  });

  return app;
}

// Start Server if run directly
const isDirectExecution = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  process.argv[1].endsWith('server/index.js') ||
  process.argv[1].endsWith('server\\index.js')
);

if (isDirectExecution) {
  // Run schema migration on startup
  runMigrations(db);

  // Auto-seed if database is brand new (no subsystems)
  const mode = (process.env.NODE_ENV || 'development').toLowerCase();
  const subCount = db.prepare('SELECT count(*) as count FROM subsystems').get().count;

  if (subCount === 0) {
    if (mode === 'production') {
      console.log('🏭 [STARTUP:PROD] Base vide détectée : initialisation des sous-systèmes officiels et du compte Admin...');
      runProdSeed(db);
    } else {
      console.log('🧪 [STARTUP:DEV] Base vide détectée : chargement des données de démonstration/test...');
      runDemoSeed(db);
    }
  }

  const app = createApp(db);
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, '::', () => {
    console.log(`🏎️  FSAE Order Manager Server [MODE: ${mode.toUpperCase()}] running on port ${PORT}`);
    console.log(`📁  Base de données active : ${getDbPath()}`);
  });
}

export default createApp;
