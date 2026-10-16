require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function main() {
  const files = [
    '20261012_ai_agent_foundation.sql',
    '20261012_ai_service_enabled.sql',
    '20261012_ai_rag_protocols.sql',
  ];
  for (const file of files) {
    const sqlPath = path.join(__dirname, '../../migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    try {
      await pool.query(sql);
      console.log(`Applied ${file}`);
    } catch (error) {
      if (file.includes('rag') && String(error.message).includes('vector')) {
        console.warn(`Skipped ${file} (pgvector unavailable): ${error.message}`);
      } else {
        throw error;
      }
    }
  }
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
