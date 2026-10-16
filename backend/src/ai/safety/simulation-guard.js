const { query } = require('../../config/db');

const DEMO_SOURCES = new Set(['seedRandomArrivals', 'demo', 'simulation']);

async function isVisitSimulationEligible(visitId) {
  const result = await query(
    `SELECT 1
     FROM visit_events
     WHERE visit_id = $1
       AND metadata->>'source' = ANY($2::text[])
     LIMIT 1`,
    [visitId, Array.from(DEMO_SOURCES)],
  );
  return result.rowCount > 0;
}

module.exports = {
  DEMO_SOURCES,
  isVisitSimulationEligible,
};
