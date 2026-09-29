import { Router } from 'express';
import { db as defaultDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export function createUsersRouter(db = defaultDb) {
  const router = Router();

  // All endpoints require Admin role
  router.use(authenticateToken, requireRole('Admin'));

  // GET /api/users — List all users
  router.get('/', (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, name, email, role, department, subsystem, discord_handle, tshirt_size, created_at
        FROM users
        ORDER BY id ASC
      `).all();

      return res.status(200).json(users);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve users: ' + err.message });
    }
  });

  // PATCH /api/users/:id — Update role, department, subsystem, discord_handle, name
  router.patch('/:id', (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { role, department, subsystem, discord_handle, name } = req.body;

      // Validate role if supplied
      const validRoles = ['Member', 'Lead', 'Purchaser', 'Admin'];
      if (role !== undefined && !validRoles.includes(role)) {
        return res.status(400).json({
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }

      // Anti-lockout protections
      if (role !== undefined && targetUser.role === 'Admin' && role !== 'Admin') {
        // 1. Admin cannot demote themselves
        if (Number(req.user.id) === Number(targetUser.id)) {
          return res.status(400).json({
            error: 'Vous ne pouvez pas vous rétrograder vous-même de votre rôle Administrateur'
          });
        }

        // 2. Cannot demote the last remaining Admin
        const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'").get().count;
        if (adminCount <= 1) {
          return res.status(400).json({
            error: 'Impossible de rétrograder le dernier administrateur du système'
          });
        }
      }

      // Name validation: cannot be blank if provided
      if (name !== undefined && String(name).trim() === '') {
        return res.status(400).json({ error: 'Le nom ne peut pas être vide' });
      }

      const { tshirt_size } = req.body;
      const updatedRole = role !== undefined ? role : targetUser.role;
      const updatedDept = department !== undefined ? (department ? String(department).trim() : null) : targetUser.department;
      const updatedSub = subsystem !== undefined ? (subsystem ? String(subsystem).trim() : null) : targetUser.subsystem;
      const updatedDiscord = discord_handle !== undefined ? (discord_handle ? String(discord_handle).trim() : null) : targetUser.discord_handle;
      const updatedName = name !== undefined ? String(name).trim() : targetUser.name;
      const updatedTshirt = tshirt_size !== undefined ? (tshirt_size ? String(tshirt_size).trim() : null) : targetUser.tshirt_size;

      db.prepare(`
        UPDATE users
        SET role = ?, department = ?, subsystem = ?, discord_handle = ?, name = ?, tshirt_size = ?
        WHERE id = ?
      `).run(updatedRole, updatedDept, updatedSub, updatedDiscord, updatedName, updatedTshirt, userId);

      const updatedUser = db.prepare(`
        SELECT id, name, email, role, department, subsystem, discord_handle, tshirt_size, created_at
        FROM users
        WHERE id = ?
      `).get(userId);

      return res.status(200).json(updatedUser);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update user: ' + err.message });
    }
  });

  // DELETE /api/users/:id — Secure user deletion
  router.delete('/:id', (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Anti-lockout: Cannot delete oneself
      if (Number(req.user.id) === Number(targetUser.id)) {
        return res.status(400).json({
          error: 'Vous ne pouvez pas supprimer votre propre compte'
        });
      }

      // Anti-lockout: Cannot delete the last Admin
      if (targetUser.role === 'Admin') {
        const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'").get().count;
        if (adminCount <= 1) {
          return res.status(400).json({
            error: 'Impossible de supprimer le dernier administrateur du système'
          });
        }
      }

      // Foreign key safeguard: Check if user has associated requests or purchase orders
      const prCount = db.prepare('SELECT COUNT(*) as count FROM part_requests WHERE requester_id = ?').get(userId).count;
      const poCount = db.prepare('SELECT COUNT(*) as count FROM purchase_orders WHERE purchaser_id = ?').get(userId).count;
      if (prCount > 0 || poCount > 0) {
        return res.status(400).json({
          error: 'Impossible de supprimer un utilisateur associé à des demandes de pièces ou des commandes. Veuillez d’abord réassigner ou archiver ces éléments.'
        });
      }

      const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        message: `Utilisateur ${targetUser.name} supprimé avec succès`
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete user: ' + err.message });
    }
  });

  return router;
}

export default createUsersRouter();
