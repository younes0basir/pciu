const { query } = require('../config/db');

const LOAD_LEVELS = ['normal', 'high_load', 'saturated'];

async function calculateLoad() {
  const [resources, active, care, disposition, critical] = await Promise.all([
    query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE operational_status = 'ready'
          AND NOT EXISTS (
          SELECT 1 FROM bed_assignments ba WHERE ba.bed_id = beds.id AND ba.released_at IS NULL
        ))::int AS ready_free
       FROM beds
       WHERE is_active`,
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM visits
       WHERE closed_at IS NULL AND care_stage NOT IN ('completed')`,
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM visits
       WHERE closed_at IS NULL AND care_stage = 'waiting_care'`,
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM visits
       WHERE closed_at IS NULL AND care_stage = 'disposition_pending'`,
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM visits
       WHERE closed_at IS NULL AND priority <= 2`,
    ),
  ]);

  const totalBeds = resources.rows[0]?.total ?? 0;
  const readyFree = resources.rows[0]?.ready_free ?? 0;
  const waitingCare = care.rows[0]?.count ?? 0;
  const dispositionPending = disposition.rows[0]?.count ?? 0;
  const p1p2 = critical.rows[0]?.count ?? 0;
  const activeVisits = active.rows[0]?.count ?? 0;

  let loadStatus = 'normal';
  if (
    readyFree === 0 &&
    (waitingCare >= 4 || dispositionPending >= 2 || p1p2 >= 2)
  ) {
    loadStatus = 'saturated';
  } else if (readyFree <= 1 && waitingCare >= 3) {
    loadStatus = 'high_load';
  }

  return {
    timestamp: new Date().toISOString(),
    loadStatus,
    levels: LOAD_LEVELS,
    metrics: {
      totalBeds,
      readyFreeBeds: readyFree,
      activeVisits,
      waitingCare,
      dispositionPending,
      p1p2Active: p1p2,
    },
  };
}

module.exports = {
  calculateLoad,
  LOAD_LEVELS,
};
