import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { db as defaultDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { uploadInvoice, validatePdfMagicBytes, handleUploadErrors } from '../middleware/upload.js';

export function createInvoicesRouter(db = defaultDb) {
  const router = Router();

  // POST /api/invoices/po/:po_id — Upload PDF invoice linked to PO
  router.post(
    '/po/:po_id',
    authenticateToken,
    requireRole(['Purchaser', 'Admin']),
    uploadInvoice.single('file'),
    handleUploadErrors,
    validatePdfMagicBytes,
    (req, res) => {
      try {
        const poId = parseInt(req.params.po_id, 10);
        const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId);

        if (!po) {
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(404).json({ error: `Purchase Order #${poId} not found` });
        }

        const amount = req.body.amount !== undefined ? parseFloat(req.body.amount) : po.total_cost;
        if (isNaN(amount) || amount < 0) {
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({ error: 'Amount must be a non-negative number' });
        }

        const relativePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');

        const insert = db.prepare(`
          INSERT INTO invoices (po_id, file_name, file_path, amount)
          VALUES (?, ?, ?, ?)
        `).run(poId, req.file.originalname, relativePath, amount);

        const created = db.prepare('SELECT * FROM invoices WHERE id = ?').get(insert.lastInsertRowid);
        return res.status(201).json(created);
      } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return res.status(500).json({ error: 'Failed to save invoice: ' + err.message });
      }
    }
  );

  // GET /api/invoices/:id/download — Secure PDF stream
  router.get('/:id/download', authenticateToken, (req, res) => {
    try {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const absolutePath = path.resolve(process.cwd(), invoice.file_path);
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: 'Invoice file missing on server storage' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(invoice.file_name)}"`);
      return res.sendFile(absolutePath);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to download invoice: ' + err.message });
    }
  });

  // GET /api/invoices/po/:po_id — List invoices for a PO
  router.get('/po/:po_id', authenticateToken, (req, res) => {
    try {
      const invoices = db.prepare('SELECT * FROM invoices WHERE po_id = ? ORDER BY upload_date DESC').all(req.params.po_id);
      return res.status(200).json(invoices);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to list invoices: ' + err.message });
    }
  });

  // DELETE /api/invoices/:id — Delete invoice (Purchaser/Admin)
  router.delete('/:id', authenticateToken, requireRole(['Purchaser', 'Admin']), (req, res) => {
    try {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const absolutePath = path.resolve(process.cwd(), invoice.file_path);
      if (fs.existsSync(absolutePath)) {
        try { fs.unlinkSync(absolutePath); } catch (e) {}
      }

      db.prepare('DELETE FROM invoices WHERE id = ?').run(invoice.id);
      return res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete invoice: ' + err.message });
    }
  });

  return router;
}

export default createInvoicesRouter();
