const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { getAdminEnvConfig, isEnvAdminEmail } = require('../config/adminEnv');

async function authenticateSse(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const rawToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;

  if (!rawToken) {
    return res.status(401).json({ error: 'Authentication required for event stream.' });
  }

  try {
    const decoded = jwt.verify(
      rawToken,
      process.env.JWT_SECRET || 'super_secret_picu_jwt_key_2026_safe_change',
    );

    const userResult = await query(
      'SELECT id, first_name, last_name, email, role, is_active FROM users WHERE id = $1',
      [decoded.userId],
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

module.exports = { authenticateSse };
