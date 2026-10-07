const jwt = require('jsonwebtoken');
const { getAdminEnvConfig, isEnvAdminEmail } = require('../config/adminEnv');
const { hasCapability } = require('../config/roles');
const { query } = require('../config/db');

async function authenticateJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_picu_jwt_key_2026_safe_change');
    
    // Check if user is still active in database
    const userResult = await query(
      'SELECT id, first_name, last_name, email, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].is_active) {
      return res.status(401).json({ error: 'User account is inactive or not found.' });
    }

    const user = userResult.rows[0];
    if (user.role === 'admin') {
      if (!getAdminEnvConfig()) {
        return res.status(403).json({ error: 'Admin access is not configured on this server.' });
      }
      if (!isEnvAdminEmail(user.email)) {
        return res.status(403).json({ error: 'Admin access denied for this account.' });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}.`,
      });
    }
    next();
  };
}

function requireCapability(capability) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!hasCapability(req.user.role, capability)) {
      return res.status(403).json({
        error: `Permission denied. Role '${req.user.role}' lacks capability '${capability}'.`,
      });
    }
    next();
  };
}

module.exports = {
  authenticateJwt,
  requireRole,
  requireCapability,
};
