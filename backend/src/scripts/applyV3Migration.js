require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function main() {
  const files = [
    '20261011_v3_smart_emergency_flow.sql',
    '20261012_v3_exams_tasks.sql',
  ];
  for (const file of files) {
    const sqlPath = path.join(__dirname, '../../migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }

  const columns = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'visits'
       AND column_name IN ('care_stage', 'critical_flag', 'outcome')
     ORDER BY 1`,
  );

  console.log(JSON.stringify({ visitV3Columns: columns.rows }));
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
