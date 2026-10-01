import { Router } from 'express';
import { db as defaultDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export function createSubsystemsRouter(db = defaultDb) {
  const router = Router();

  // GET /api/subsystems/public-list — Public unauthenticated list for registration and dropdowns
  router.get('/public-list', (req, res) => {
    try {
      const rows = db.prepare('SELECT id, name, code FROM subsystems ORDER BY id ASC').all();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve public subsystems: ' + err.message });
    }
  });

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
        const committed_cost = Number(r.committed_cost.toFixed(2));
        const actual_cost = Number(r.actual_cost.toFixed(2));
        const totalSpentOrCommitted = Number((committed_cost + actual_cost).toFixed(2));
        const remaining_budget = Number((r.budget_allocated - totalSpentOrCommitted).toFixed(2));
        const pct_used = r.budget_allocated > 0 
          ? Number(((totalSpentOrCommitted / r.budget_allocated) * 100).toFixed(2))
          : 0;

        return {
          id: r.id,
          name: r.name,
          code: r.code,
          budget_allocated: r.budget_allocated,
          committed_cost,
          actual_cost,
          remaining_budget,
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
      const budget = budget_allocated !== undefined ? parseFloat(budget_allocated) : 0.0;

      if (!Number.isFinite(budget) || budget < 0) {
        return res.status(400).json({ error: 'Budget allocated must be a non-negative number (>= 0)' });
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

  // PATCH /api/subsystems/:id — Update subsystem name, code, or budget (Admin only)
  router.patch('/:id', authenticateToken, requireRole('Admin'), (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid subsystem ID' });
      }

      const existing = db.prepare('SELECT * FROM subsystems WHERE id = ?').get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Subsystem not found' });
      }

      const { name, code, budget_allocated } = req.body;

      let newBudget = existing.budget_allocated;
      if (budget_allocated !== undefined) {
        const parsedBudget = parseFloat(budget_allocated);
        if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
          return res.status(400).json({ error: 'Budget allocated must be a non-negative number (>= 0)' });
        }
        newBudget = parsedBudget;
      }

      let newCode = existing.code;
      if (code !== undefined) {
        const cleanCode = String(code).trim().toUpperCase();
        if (!cleanCode) {
          return res.status(400).json({ error: 'Subsystem code cannot be empty' });
        }
        const duplicate = db.prepare('SELECT id FROM subsystems WHERE code = ? AND id != ?').get(cleanCode, id);
        if (duplicate) {
          return res.status(409).json({ error: `Subsystem code ${cleanCode} already exists` });
        }
        newCode = cleanCode;
      }

      let newName = existing.name;
      if (name !== undefined) {
        const cleanName = String(name).trim();
        if (!cleanName) {
          return res.status(400).json({ error: 'Subsystem name cannot be empty' });
        }
        newName = cleanName;
      }

      db.prepare(`
        UPDATE subsystems
        SET name = ?, code = ?, budget_allocated = ?
        WHERE id = ?
      `).run(newName, newCode, newBudget, id);

      const updated = db.prepare('SELECT * FROM subsystems WHERE id = ?').get(id);
      return res.status(200).json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update subsystem: ' + err.message });
    }
  });

  // DELETE /api/subsystems/:id — Delete subsystem if no part_requests reference it (Admin only)
  router.delete('/:id', authenticateToken, requireRole('Admin'), (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid subsystem ID' });
      }

      const existing = db.prepare('SELECT * FROM subsystems WHERE id = ?').get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Subsystem not found' });
      }

      const refCount = db.prepare('SELECT COUNT(*) as count FROM part_requests WHERE subsystem_id = ?').get(id).count;
      if (refCount > 0) {
        return res.status(400).json({
          error: `Impossible de supprimer le sous-système: ${refCount} demande(s) de pièces y sont associées.`
        });
      }

      db.prepare('DELETE FROM subsystems WHERE id = ?').run(id);
      return res.status(200).json({ message: 'Subsystem deleted successfully', id });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete subsystem: ' + err.message });
    }
  });

  return router;
}

export default createSubsystemsRouter();
