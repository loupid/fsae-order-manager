import { Router } from 'express';
import { db as defaultDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export function createSubsystemsRouter(db = defaultDb) {
  const router = Router();

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

      if (!name || !code) {
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

  return router;
}

export default createSubsystemsRouter();
