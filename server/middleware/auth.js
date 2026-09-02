import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fsae-secret-key-2026-development';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generates a signed JWT token for an authenticated user.
 * @param {{ id: number, email: string, role: string, name: string }} user
 * @param {string} [expiresIn]
 * @returns {string} Signed JWT token
 */
export function generateToken(user, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Express middleware to verify Bearer JWT token.
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

/**
 * RBAC middleware to enforce user roles.
 * @param {string|string[]} allowedRoles
 */
export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Requires one of [${roles.join(', ')}] role. Current role: ${req.user.role}`
      });
    }

    next();
  };
}

export { JWT_SECRET };
