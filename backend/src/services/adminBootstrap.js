const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { getAdminEnvConfig } = require('../config/adminEnv');

async function syncAdminFromEnv() {
  const config = getAdminEnvConfig();
  if (!config) {
    return { synced: false, reason: 'ADMIN_EMAIL and ADMIN_PASSWORD not set' };
  }

  const passwordHash = await bcrypt.hash(config.password, 10);

  const result = await query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, 'admin', true)
     ON CONFLICT ((lower(email))) DO UPDATE
     SET first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         is_active = true,
         updated_at = NOW()
     RETURNING id, email`,
    [config.firstName, config.lastName, config.email, passwordHash]
  );

  return {
    synced: true,
    userId: result.rows[0]?.id,
    email: result.rows[0]?.email,
  };
}

module.exports = { syncAdminFromEnv };
