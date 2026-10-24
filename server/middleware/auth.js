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
 * Middleware requiring admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in as an administrator.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Administrative privileges are required.'
    });
  }

  next();
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
  generateToken,
  JWT_SECRET
};
