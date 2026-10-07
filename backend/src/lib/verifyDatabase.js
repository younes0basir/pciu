const { Pool } = require('pg');

async function verifyDatabase(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 8_000,
  });

  try {
    await pool.query('SELECT 1 AS ok');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unknown database error',
    };
  } finally {
    await pool.end();
  }
}

module.exports = { verifyDatabase };
