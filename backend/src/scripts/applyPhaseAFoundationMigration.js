require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function main() {
  const sqlPath = path.join(__dirname, '../../migrations/20261008_phase_a_foundation.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);

  const columns = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'visit_events'
       AND column_name IN ('actor_type', 'agent_run_id', 'idempotency_key')
     ORDER BY 1`,
  );

  console.log(JSON.stringify({ visitEventColumns: columns.rows }));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {
    // pool already closed
  }
  process.exit(1);
});
