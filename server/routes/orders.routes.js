import { Router } from 'express';
import { db as defaultDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { notifyPurchaseOrderCreated, notifyPartsReceived } from '../services/discord/discordWebhook.js';

export function createOrdersRouter(db = defaultDb, customWebhookUrl) {
  const router = Router();

  // Helper to generate next sequential PO Number
  function generatePoNumber(targetDb) {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const lastPo = targetDb.prepare(`
      SELECT po_number FROM purchase_orders 
      WHERE po_number LIKE ? 
      ORDER BY id DESC LIMIT 1
    `).get(`${prefix}%`);

    let nextSeq = 1;
    if (lastPo && lastPo.po_number) {
      const parts = lastPo.po_number.split('-');
      const num = parseInt(parts[2], 10);
      if (!isNaN(num)) nextSeq = num + 1;
    }
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  // GET /api/purchase-orders — List all POs with items & invoices
  router.get('/', authenticateToken, (req, res) => {
    try {
      const pos = db.prepare(`
        SELECT po.*, u.name AS purchaser_name, u.email AS purchaser_email
        FROM purchase_orders po
        JOIN users u ON po.purchaser_id = u.id
        ORDER BY po.created_at DESC
      `).all();

      const results = pos.map(po => {
        const items = db.prepare(`
          SELECT pr.*, s.name AS subsystem_name, s.code AS subsystem_code, u.name AS requester_name
          FROM part_requests pr
          JOIN subsystems s ON pr.subsystem_id = s.id
          JOIN users u ON pr.requester_id = u.id
          WHERE pr.po_id = ?
        `).all(po.id);

        const invoices = db.prepare('SELECT * FROM invoices WHERE po_id = ?').all(po.id);

        return {
          ...po,
          items,
          invoices,
          items_count: items.length,
          received_count: items.filter(i => i.status === 'RECEIVED').length
        };
      });

      return res.status(200).json(results);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch purchase orders: ' + err.message });
    }
  });

  // GET /api/purchase-orders/:id
  router.get('/:id', authenticateToken, (req, res) => {
    try {
      const po = db.prepare(`
        SELECT po.*, u.name AS purchaser_name, u.email AS purchaser_email
        FROM purchase_orders po
        JOIN users u ON po.purchaser_id = u.id
        WHERE po.id = ?
      `).get(req.params.id);

      if (!po) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      const items = db.prepare(`
        SELECT pr.*, s.name AS subsystem_name, s.code AS subsystem_code, u.name AS requester_name
        FROM part_requests pr
        JOIN subsystems s ON pr.subsystem_id = s.id
        JOIN users u ON pr.requester_id = u.id
        WHERE pr.po_id = ?
      `).all(po.id);

      const invoices = db.prepare('SELECT * FROM invoices WHERE po_id = ?').all(po.id);

      return res.status(200).json({ ...po, items, invoices });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch purchase order: ' + err.message });
    }
  });

  // POST /api/purchase-orders — 1-Click PO grouping & creation
  router.post('/', authenticateToken, requireRole(['Purchaser', 'Admin']), (req, res) => {
    try {
      const { supplier, request_ids } = req.body;

      if (!supplier || !Array.isArray(request_ids) || request_ids.length === 0) {
        return res.status(400).json({ error: 'Supplier and a non-empty list of request_ids are required' });
      }

      // Fetch requests
      const placeholders = request_ids.map(() => '?').join(',');
      const requests = db.prepare(`
        SELECT pr.*, s.code AS subsystem_code, s.name AS subsystem_name
        FROM part_requests pr
        JOIN subsystems s ON pr.subsystem_id = s.id
        WHERE pr.id IN (${placeholders})
      `).all(...request_ids);

      if (requests.length !== request_ids.length) {
        return res.status(400).json({ error: 'One or more requested part requests do not exist' });
      }

      // Verify same supplier and unassigned
      for (const reqItem of requests) {
        if (reqItem.supplier.toLowerCase() !== supplier.trim().toLowerCase()) {
          return res.status(400).json({
            error: `Supplier mismatch: Request #${reqItem.id} has supplier '${reqItem.supplier}', expected '${supplier}'`
          });
        }
        if (reqItem.po_id !== null && reqItem.status === 'ORDERED') {
          return res.status(400).json({
            error: `Request #${reqItem.id} is already assigned to active PO #${reqItem.po_id}`
          });
        }
      }

      // Calculate total cost
      const totalCost = requests.reduce((sum, r) => sum + (r.quantity * r.unit_price_est), 0);
      const poNumber = generatePoNumber(db);

      // Atomic Transaction: Create PO and link requests
      const createPoTransaction = db.transaction(() => {
        const poInsert = db.prepare(`
          INSERT INTO purchase_orders (po_number, supplier, status, purchaser_id, total_cost)
          VALUES (?, ?, 'ORDERED', ?, ?)
        `).run(poNumber, supplier.trim(), req.user.id, totalCost);

        const newPoId = poInsert.lastInsertRowid;

        const updateReq = db.prepare(`
          UPDATE part_requests 
          SET po_id = ?, status = 'ORDERED', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);

        for (const reqItem of requests) {
          updateReq.run(newPoId, reqItem.id);
        }

        return newPoId;
      });

      const newPoId = createPoTransaction();
      const createdPo = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(newPoId);

      // Async Discord Webhook Alert (Non-blocking)
      notifyPurchaseOrderCreated(createdPo, requests, req.user, customWebhookUrl).catch(() => {});

      return res.status(201).json({
        ...createdPo,
        items: requests
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create purchase order: ' + err.message });
    }
  });

  // PATCH /api/purchase-orders/:id/status — Update PO Status
  router.patch('/:id/status', authenticateToken, requireRole(['Purchaser', 'Admin']), (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['PENDING', 'ORDERED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
      if (!po) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      const updateTx = db.transaction(() => {
        db.prepare(`
          UPDATE purchase_orders 
          SET status = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(status, po.id);

        if (status === 'COMPLETED') {
          db.prepare(`
            UPDATE part_requests 
            SET status = 'RECEIVED', updated_at = CURRENT_TIMESTAMP 
            WHERE po_id = ?
          `).run(po.id);
        } else if (status === 'CANCELLED') {
          db.prepare(`
            UPDATE part_requests 
            SET po_id = NULL, status = 'APPROVED', updated_at = CURRENT_TIMESTAMP 
            WHERE po_id = ?
          `).run(po.id);
        }
      });

      updateTx();

      const updatedPo = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(po.id);
      const items = db.prepare(`
        SELECT pr.*, s.code AS subsystem_code, s.name AS subsystem_name 
        FROM part_requests pr 
        JOIN subsystems s ON pr.subsystem_id = s.id 
        WHERE pr.po_id = ?
      `).all(po.id);

      if (status === 'COMPLETED') {
        notifyPartsReceived(updatedPo, items, customWebhookUrl).catch(() => {});
      }

      return res.status(200).json({ ...updatedPo, items });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update purchase order: ' + err.message });
    }
  });

  return router;
}

export default createOrdersRouter();
