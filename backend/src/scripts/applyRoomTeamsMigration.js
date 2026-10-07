require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function main() {
  const sqlPath = path.join(__dirname, '../../migrations/20261007_room_teams.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  const tables = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('room_teams', 'room_team_nurses')
     ORDER BY 1`
  );
  const col = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'consultations' AND column_name = 'recorded_by'`
  );
  console.log(JSON.stringify({ tables: tables.rows, recordedBy: col.rows }));
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
