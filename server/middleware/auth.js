const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '590labs_production_super_secret_jwt_key_2026_urban_streetwear';

/**
 * Extracts and verifies JWT from cookie or Bearer authorization header.
 * Attaches user object to req.user if valid, otherwise sets req.user = null.
 */
function authenticateToken(req, res, next) {
  let token = null;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Fallback to HTTP-only cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded;
    }
    next();
  });
}

const ADMIN_ROLES = ['owner', 'admin', 'staff'];

/**
 * Middleware requiring user to be logged in
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in to access this resource.'
    });
  }
  next();
}

/**
 * Middleware requiring an administrative role (owner, admin, or staff)
 * Performs live database lookup to prevent revoked tokens from retaining access.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in as an administrator.'
    });
  }

  // Live check in database to guard against revoked permissions or deleted accounts
  try {
    const db = require('../db');
    const userRow = db.prepare('SELECT id, role, email FROM users WHERE id = ?').get(req.user.id);
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Administrative privileges are required.'
      });
    }
    // Update req.user with latest DB role
    req.user.role = userRow.role;
    next();
  } catch (err) {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Administrative privileges are required.'
      });
    }
    next();
  }
}

/**
 * Middleware requiring Owner role
 */
function requireOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in as the store owner.'
    });
  }

  try {
    const db = require('../db');
    const userRow = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.user.id);
    if (!userRow || userRow.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only the store Owner is authorized to perform this operation.'
      });
    }
    req.user.role = userRow.role;
    next();
  } catch (err) {
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Owner privilege required.'
      });
    }
    next();
  }
}

/**
 * Factory for checking specific allowed roles
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Permitted roles: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
}

/**
 * Helper to generate JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = {
  authenticateToken,
  requireAuth,
  requireAdmin,
  requireOwner,
  requireRole,
  ADMIN_ROLES,
  generateToken,
  JWT_SECRET
};

