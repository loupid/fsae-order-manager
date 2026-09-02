import { Router } from 'express';
import { db as defaultDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export function createRequestsRouter(db = defaultDb) {
  const router = Router();

  // GET /api/part-requests — Filterable request list
  router.get('/', authenticateToken, (req, res) => {
    try {
      const { subsystem_id, urgency_level, status, supplier, requester_id, po_id } = req.query;

      let sql = `
        SELECT 
          pr.*,
          u.name AS requester_name,
          u.email AS requester_email,
          s.name AS subsystem_name,
          s.code AS subsystem_code,
          po.po_number
        FROM part_requests pr
        JOIN users u ON pr.requester_id = u.id
        JOIN subsystems s ON pr.subsystem_id = s.id
        LEFT JOIN purchase_orders po ON pr.po_id = po.id
        WHERE 1=1
      `;
      const params = [];

      if (subsystem_id) {
        sql += ` AND pr.subsystem_id = ?`;
        params.push(Number(subsystem_id));
      }
      if (urgency_level) {
        sql += ` AND pr.urgency_level = ?`;
        params.push(urgency_level);
      }
      if (status) {
        sql += ` AND pr.status = ?`;
        params.push(status);
      }
      if (supplier) {
        sql += ` AND pr.supplier LIKE ?`;
        params.push(`%${supplier}%`);
      }
      if (requester_id) {
        sql += ` AND pr.requester_id = ?`;
        params.push(Number(requester_id));
      }
      if (po_id) {
        sql += ` AND pr.po_id = ?`;
        params.push(Number(po_id));
      }

      sql += ` ORDER BY 
        CASE pr.urgency_level 
          WHEN 'CRITICAL' THEN 1 
          WHEN 'URGENT' THEN 2 
          WHEN 'NORMAL' THEN 3 
          ELSE 4 
        END,
        pr.created_at DESC
      `;

      const requests = db.prepare(sql).all(...params);
      return res.status(200).json(requests);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch part requests: ' + err.message });
    }
  });

  // POST /api/part-requests — Submit new part request
  router.post('/', authenticateToken, (req, res) => {
    try {
      const {
        subsystem_id,
        supplier,
        sku,
        url,
        description,
        quantity,
        unit_price_est,
        urgency_level,
        status
      } = req.body;

      if (!subsystem_id || !supplier || !sku || !description) {
        return res.status(400).json({ error: 'Subsystem, supplier, sku, and description are required' });
      }

      const parsedSubsystemId = Number(subsystem_id);
      const qty = parseInt(quantity, 10) || 1;
      const price = parseFloat(unit_price_est) || 0.0;
      const urgency = ['NORMAL', 'URGENT', 'CRITICAL'].includes(urgency_level) ? urgency_level : 'NORMAL';
      const initialStatus = ['DRAFT', 'SUBMITTED'].includes(status) ? status : 'SUBMITTED';

      if (qty <= 0) {
        return res.status(400).json({ error: 'Quantity must be greater than 0' });
      }
      if (price < 0) {
        return res.status(400).json({ error: 'Unit price must be >= 0' });
      }

      // Check subsystem existence
      const sub = db.prepare('SELECT id FROM subsystems WHERE id = ?').get(parsedSubsystemId);
      if (!sub) {
        return res.status(400).json({ error: 'Invalid subsystem_id' });
      }

      const result = db.prepare(`
        INSERT INTO part_requests (
          requester_id, subsystem_id, supplier, sku, url, description, quantity, unit_price_est, urgency_level, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        parsedSubsystemId,
        supplier.trim(),
        sku.trim(),
        url ? url.trim() : null,
        description.trim(),
        qty,
        price,
        urgency,
        initialStatus
      );

      const created = db.prepare(`
        SELECT pr.*, u.name AS requester_name, s.name AS subsystem_name, s.code AS subsystem_code
        FROM part_requests pr
        JOIN users u ON pr.requester_id = u.id
        JOIN subsystems s ON pr.subsystem_id = s.id
        WHERE pr.id = ?
      `).get(result.lastInsertRowid);

      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create part request: ' + err.message });
    }
  });

  // GET /api/part-requests/:id
  router.get('/:id', authenticateToken, (req, res) => {
    try {
      const request = db.prepare(`
        SELECT pr.*, u.name AS requester_name, u.email AS requester_email, s.name AS subsystem_name, s.code AS subsystem_code, po.po_number
        FROM part_requests pr
        JOIN users u ON pr.requester_id = u.id
        JOIN subsystems s ON pr.subsystem_id = s.id
        LEFT JOIN purchase_orders po ON pr.po_id = po.id
        WHERE pr.id = ?
      `).get(req.params.id);

      if (!request) {
        return res.status(404).json({ error: 'Part request not found' });
      }

      return res.status(200).json(request);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch part request: ' + err.message });
    }
  });

  // PATCH /api/part-requests/:id/status — Status update (Purchaser/Admin)
  router.patch('/:id/status', authenticateToken, requireRole(['Purchaser', 'Admin']), (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'REJECTED'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const reqRow = db.prepare('SELECT * FROM part_requests WHERE id = ?').get(req.params.id);
      if (!reqRow) {
        return res.status(404).json({ error: 'Part request not found' });
      }

      db.prepare(`
        UPDATE part_requests 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(status, req.params.id);

      const updated = db.prepare(`
        SELECT pr.*, u.name AS requester_name, s.name AS subsystem_name, s.code AS subsystem_code, po.po_number
        FROM part_requests pr
        JOIN users u ON pr.requester_id = u.id
        JOIN subsystems s ON pr.subsystem_id = s.id
        LEFT JOIN purchase_orders po ON pr.po_id = po.id
        WHERE pr.id = ?
      `).get(req.params.id);

      return res.status(200).json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update request status: ' + err.message });
    }
  });

  // DELETE /api/part-requests/:id — Delete request (Owner if SUBMITTED/DRAFT, Admin any)
  router.delete('/:id', authenticateToken, (req, res) => {
    try {
      const reqRow = db.prepare('SELECT * FROM part_requests WHERE id = ?').get(req.params.id);
      if (!reqRow) {
        return res.status(404).json({ error: 'Part request not found' });
      }

      // Check ownership or admin
      const isOwner = reqRow.requester_id === req.user.id;
      const isAdmin = req.user.role === 'Admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: You can only delete your own requests' });
      }

      // Non-admin can only delete if not ordered/received
      if (!isAdmin && ['ORDERED', 'RECEIVED'].includes(reqRow.status)) {
        return res.status(400).json({ error: 'Cannot delete part request that is already ordered or received' });
      }

      db.prepare('DELETE FROM part_requests WHERE id = ?').run(req.params.id);
      return res.status(200).json({ success: true, message: 'Part request deleted successfully' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete part request: ' + err.message });
    }
  });

  return router;
}

export default createRequestsRouter();
