function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Admin identity is defined only via environment (never public register / user API).
 * Required: ADMIN_EMAIL, ADMIN_PASSWORD
 * Optional: ADMIN_FIRST_NAME, ADMIN_LAST_NAME
 */
function getAdminEnvConfig() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  const firstName = (process.env.ADMIN_FIRST_NAME || 'PICU').trim();
  const lastName = (process.env.ADMIN_LAST_NAME || 'Admin').trim();

  return { email, password, firstName, lastName };
}

function isEnvAdminEmail(email) {
  const config = getAdminEnvConfig();
  if (!config) return false;
  return normalizeEmail(email) === config.email;
}

module.exports = {
  getAdminEnvConfig,
  isEnvAdminEmail,
  normalizeEmail,
};
