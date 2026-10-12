const express = require('express');
const { query } = require('../config/db');
const { authenticateJwt, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/workflow', authenticateJwt, requireRole('chief', 'admin'), async (_req, res, next) => {
  try {
    const counts = await query(
      `SELECT status, COUNT(*)::int AS count
       FROM visits
       WHERE status IN ('waiting', 'placed', 'in_treatment')
       GROUP BY status`,
    );

    const careCounts = await query(
      `SELECT care_stage, COUNT(*)::int AS count
       FROM visits
       WHERE closed_at IS NULL AND care_stage IS NOT NULL
       GROUP BY care_stage`,
    );

    const byStatus = Object.fromEntries(counts.rows.map((row) => [row.status, row.count]));
    const byCareStage = Object.fromEntries(careCounts.rows.map((row) => [row.care_stage, row.count]));

    const recentEvents = await query(
      `SELECT event_type, COUNT(*)::int AS count
       FROM visit_events
       WHERE created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY event_type
       ORDER BY event_type`,
    );

    res.json({
      timestamp: new Date().toISOString(),
      activeVisits: {
        waiting: byStatus.waiting ?? 0,
        placed: byStatus.placed ?? 0,
        inTreatment: byStatus.in_treatment ?? 0,
      },
      careStages: byCareStage,
      eventsLast24h: recentEvents.rows.map((row) => ({
        eventType: row.event_type,
        count: row.count,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
