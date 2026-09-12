import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db as defaultDb } from '../db/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

export function createAuthRouter(db = defaultDb) {
  const router = Router();

  // GET /api/auth/setup-status
  router.get('/setup-status', (req, res) => {
    try {
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
      return res.status(200).json({ isCleanInstall: userCount === 0, userCount });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to get setup status: ' + err.message });
    }
  });

  // POST /api/auth/register
  router.post('/register', (req, res) => {
    try {
      const { name, email, password, role, department, subsystem, discord_handle, tshirt_size } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }

      if (password.length < 3) {
        return res.status(400).json({ error: 'Password must be at least 3 characters' });
      }

      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
      const isFirstUser = userCount === 0;
      const assignedRole = isFirstUser ? 'Admin' : (['Member', 'Purchaser', 'Admin'].includes(role) ? role : 'Member');

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const password_hash = bcrypt.hashSync(password, 10);
      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, department, subsystem, discord_handle, tshirt_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        email.trim().toLowerCase(),
        password_hash,
        assignedRole,
        department ? department.trim() : null,
        subsystem ? subsystem.trim() : null,
        discord_handle ? discord_handle.trim() : null,
        tshirt_size ? tshirt_size.trim() : null
      );

      const user = {
        id: Number(result.lastInsertRowid),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: assignedRole,
        department: department ? department.trim() : null,
        subsystem: subsystem ? subsystem.trim() : null,
        discord_handle: discord_handle ? discord_handle.trim() : null
      };

      const token = generateToken(user);
      return res.status(201).json({ token, user });
    } catch (err) {
      return res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
  });

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || null,
        subsystem: user.subsystem || null,
        discord_handle: user.discord_handle || null
      };

      const token = generateToken(safeUser);
      return res.status(200).json({ token, user: safeUser });
    } catch (err) {
      return res.status(500).json({ error: 'Login failed: ' + err.message });
    }
  });

  // GET /api/auth/me
  router.get('/me', authenticateToken, (req, res) => {
    try {
      const user = db.prepare('SELECT id, name, email, role, department, subsystem, discord_handle, tshirt_size, created_at FROM users WHERE id = ?').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json({ user });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch user profile: ' + err.message });
    }
  });

  return router;
}

export default createAuthRouter();
