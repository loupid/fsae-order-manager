import { Router } from 'express';
import { db as defaultDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export function createSubsystemsRouter(db = defaultDb) {
  const router = Router();

  function canManageBudget(user, dbInstance) {
    if (!user) return false;

    let role = user.role;
    let dept = user.department;
    let sub = user.subsystem;

    if (dbInstance && user.id) {
      try {
        const dbUser = dbInstance.prepare('SELECT role, department, subsystem FROM users WHERE id = ?').get(user.id);
        if (dbUser) {
          role = dbUser.role;
          dept = dbUser.department;
          sub = dbUser.subsystem;
        }
      } catch (err) {
        // Fall back to token claims if DB query fails
      }
    }

    if (role === 'Admin') return true;

    if (role === 'Lead' || role === 'Purchaser') {
      const normDept = (dept || '').trim().toUpperCase();
      const normSub = (sub || '').trim().toUpperCase();
      return normDept === 'TEAM ADMINISTRATION' || normDept === 'ADM' || normSub === 'TEAM ADMINISTRATION' || normSub === 'ADM';
    }

    return false;
  }

  const requireBudgetAccess = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!canManageBudget(req.user, db)) {
      return res.status(403).json({
        error: 'Forbidden: Budget access is restricted to Administrators and Team Administration Leads'
      });
    }
    next();
  };

  // GET /api/subsystems — List subsystems with financial aggregation
  router.get('/', authenticateToken, (req, res) => {
    try {
      const query = `
        SELECT 
          s.id,
          s.name,
          s.code,
          s.budget_allocated,
          s.created_at,
          COALESCE(SUM(CASE WHEN pr.status IN ('SUBMITTED', 'APPROVED', 'ORDERED') THEN pr.quantity * pr.unit_price_est ELSE 0 END), 0) AS committed_cost,
          COALESCE(SUM(CASE WHEN pr.status = 'RECEIVED' THEN pr.quantity * pr.unit_price_est ELSE 0 END), 0) AS actual_cost,
          COUNT(CASE WHEN pr.status NOT IN ('DRAFT', 'REJECTED') AND pr.id IS NOT NULL THEN pr.id ELSE NULL END) AS requests_count
        FROM subsystems s
        LEFT JOIN part_requests pr ON pr.subsystem_id = s.id
        GROUP BY s.id, s.name, s.code, s.budget_allocated, s.created_at
        ORDER BY s.id ASC
      `;

      const rows = db.prepare(query).all();
      const results = rows.map(r => {
        const totalSpentOrCommitted = r.committed_cost + r.actual_cost;
        const remaining_budget = r.budget_allocated - totalSpentOrCommitted;
        const pct_used = r.budget_allocated > 0 
          ? Number(((totalSpentOrCommitted / r.budget_allocated) * 100).toFixed(2))
          : 0;

        return {
          id: r.id,
          name: r.name,
          code: r.code,
          budget_allocated: r.budget_allocated,
          committed_cost: Number(r.committed_cost.toFixed(2)),
          actual_cost: Number(r.actual_cost.toFixed(2)),
          remaining_budget: Number(remaining_budget.toFixed(2)),
          pct_used,
          requests_count: r.requests_count,
          created_at: r.created_at
        };
      });

      return res.status(200).json(results);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve subsystems: ' + err.message });
    }
  });

  // POST /api/subsystems — Create new subsystem (Admin only)
  router.post('/', authenticateToken, requireRole('Admin'), (req, res) => {
    try {
      const { name, code, budget_allocated } = req.body;

      if (!name || !code || !String(name).trim() || !String(code).trim()) {
        return res.status(400).json({ error: 'Subsystem name and code are required' });
      }

      const cleanCode = code.trim().toUpperCase();
      const budget = parseFloat(budget_allocated) || 0.0;

      if (budget < 0) {
        return res.status(400).json({ error: 'Budget allocated must be >= 0' });
      }

      const existing = db.prepare('SELECT id FROM subsystems WHERE code = ?').get(cleanCode);
      if (existing) {
        return res.status(409).json({ error: `Subsystem code ${cleanCode} already exists` });
      }

      const result = db.prepare(`
        INSERT INTO subsystems (name, code, budget_allocated)
        VALUES (?, ?, ?)
      `).run(name.trim(), cleanCode, budget);

      const created = db.prepare('SELECT * FROM subsystems WHERE id = ?').get(result.lastInsertRowid);
      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create subsystem: ' + err.message });
    }
  });

  // PATCH /api/subsystems/:id/budget — Update allocated budget (Admin & Team Administration Leads)
  router.patch('/:id/budget', authenticateToken, requireBudgetAccess, (req, res) => {
    try {
      const subId = Number(req.params.id);
      if (!subId || isNaN(subId)) {
        return res.status(400).json({ error: 'Invalid subsystem ID' });
      }

      const { budget_allocated } = req.body;
      if (budget_allocated === undefined || budget_allocated === null || budget_allocated === '') {
        return res.status(400).json({ error: 'budget_allocated is required' });
      }

      const budget = parseFloat(budget_allocated);
      if (isNaN(budget) || budget < 0) {
        return res.status(400).json({ error: 'Budget allocated must be >= 0' });
      }

      const sub = db.prepare('SELECT * FROM subsystems WHERE id = ?').get(subId);
      if (!sub) {
        return res.status(404).json({ error: 'Subsystem not found' });
      }

      db.prepare('UPDATE subsystems SET budget_allocated = ? WHERE id = ?').run(budget, subId);

      const updated = db.prepare('SELECT * FROM subsystems WHERE id = ?').get(subId);
      return res.status(200).json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update subsystem budget: ' + err.message });
    }
  });

  return router;
}

export default createSubsystemsRouter();
