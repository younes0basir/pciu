require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function main() {
  const migrationFiles = [
    '20261014_v4_smart_workflow_foundation.sql',
    '20261014_supervision_command_center.sql',
  ];
  for (const file of migrationFiles) {
    const sqlPath = path.join(__dirname, '../../migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }

  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'visits'
       AND column_name IN ('registration_priority', 'clinical_priority_validated_at')
     ORDER BY 1`,
  );
  console.log(JSON.stringify({ visitV4Columns: cols.rows }));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
