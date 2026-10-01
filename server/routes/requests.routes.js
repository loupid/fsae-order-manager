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
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) {
          sql += ` AND pr.status = ?`;
          params.push(statuses[0]);
        } else if (statuses.length > 1) {
          const placeholders = statuses.map(() => '?').join(',');
          sql += ` AND pr.status IN (${placeholders})`;
          params.push(...statuses);
        }
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

  // PATCH /api/part-requests/:id — Edit part request (Owner, Lead, Purchaser, or Admin)
  router.patch('/:id', authenticateToken, (req, res) => {
    try {
      const reqRow = db.prepare('SELECT * FROM part_requests WHERE id = ?').get(req.params.id);
      if (!reqRow) {
        return res.status(404).json({ error: 'Part request not found' });
      }

      const isOwner = reqRow.requester_id === req.user.id;
      const isPrivileged = ['Lead', 'Purchaser', 'Admin'].includes(req.user.role);

      if (!isOwner && !isPrivileged) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to edit this request' });
      }

      if (!isPrivileged && (reqRow.po_id !== null || ['ORDERED', 'RECEIVED'].includes(reqRow.status))) {
        return res.status(400).json({ error: 'Cannot edit part request that is already assigned to a purchase order or received' });
      }

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

      const updates = [];
      const params = [];

      if (subsystem_id !== undefined) {
        const subId = Number(subsystem_id);
        const sub = db.prepare('SELECT id FROM subsystems WHERE id = ?').get(subId);
        if (!sub) {
          return res.status(400).json({ error: 'Invalid subsystem_id' });
        }
        updates.push('subsystem_id = ?');
        params.push(subId);
      }

      if (supplier !== undefined) {
        if (!supplier || !supplier.trim()) {
          return res.status(400).json({ error: 'Supplier cannot be empty' });
        }
        updates.push('supplier = ?');
        params.push(supplier.trim());
      }

      if (sku !== undefined) {
        if (!sku || !sku.trim()) {
          return res.status(400).json({ error: 'SKU cannot be empty' });
        }
        updates.push('sku = ?');
        params.push(sku.trim());
      }

      if (url !== undefined) {
        updates.push('url = ?');
        params.push(url ? url.trim() : null);
      }

      if (description !== undefined) {
        if (!description || !description.trim()) {
          return res.status(400).json({ error: 'Description cannot be empty' });
        }
        updates.push('description = ?');
        params.push(description.trim());
      }

      if (quantity !== undefined) {
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }
        updates.push('quantity = ?');
        params.push(qty);
      }

      if (unit_price_est !== undefined) {
        const price = parseFloat(unit_price_est);
        if (isNaN(price) || price < 0) {
          return res.status(400).json({ error: 'Unit price must be >= 0' });
        }
        updates.push('unit_price_est = ?');
        params.push(price);
      }

      if (urgency_level !== undefined) {
        if (!['NORMAL', 'URGENT', 'CRITICAL'].includes(urgency_level)) {
          return res.status(400).json({ error: 'Invalid urgency_level' });
        }
        updates.push('urgency_level = ?');
        params.push(urgency_level);
      }

      if (status !== undefined) {
        const validStatuses = isPrivileged
          ? ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'REJECTED']
          : ['DRAFT', 'SUBMITTED'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: `Invalid status: ${status}` });
        }
        updates.push('status = ?');
        params.push(status);
      } else if (!isPrivileged && reqRow.status === 'APPROVED') {
        // Any modification by requester to an approved request requires re-approval
        updates.push('status = ?');
        params.push('SUBMITTED');
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);

      db.prepare(`
        UPDATE part_requests 
        SET ${updates.join(', ')} 
        WHERE id = ?
      `).run(...params);

      const updated = db.prepare(`
        SELECT pr.*, u.name AS requester_name, u.email AS requester_email, s.name AS subsystem_name, s.code AS subsystem_code, po.po_number
        FROM part_requests pr
        JOIN users u ON pr.requester_id = u.id
        JOIN subsystems s ON pr.subsystem_id = s.id
        LEFT JOIN purchase_orders po ON pr.po_id = po.id
        WHERE pr.id = ?
      `).get(req.params.id);

      return res.status(200).json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update part request: ' + err.message });
    }
  });

  // PATCH /api/part-requests/:id/status — Status update (Lead/Purchaser/Admin)
  router.patch('/:id/status', authenticateToken, requireRole(['Lead', 'Purchaser', 'Admin']), (req, res) => {
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
