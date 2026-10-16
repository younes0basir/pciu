const express = require('express');
const {
  getSupervisionOverview,
  getSupervisionPipeline,
  getSupervisionCapacity,
  getSupervisionActivity,
} = require('../services/supervisionProjectionService');
const { detectBottlenecks } = require('../services/bottleneckDetectionService');
const { getEffectiveRules } = require('../services/supervisionRulesService');
const {
  listAlerts,
  acknowledgeAlert,
} = require('../services/operationalAlertService');
const {
  evaluateOperationalAlerts,
  getLastAlertEvaluationAt,
} = require('../services/supervisionAlertSyncService');
const { query } = require('../config/db');

const router = express.Router();

function parseZone(queryParams) {
  const zone = queryParams?.zone;
  if (!zone || zone === 'all') return null;
  return String(zone).slice(0, 120);
}

router.get('/overview', async (req, res, next) => {
  try {
    const payload = await getSupervisionOverview({ zoneName: parseZone(req.query) });
    payload.meta.lastAlertEvaluationAt = getLastAlertEvaluationAt();
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get('/pipeline', async (req, res, next) => {
  try {
    res.json(await getSupervisionPipeline({ zoneName: parseZone(req.query) }));
  } catch (error) {
    next(error);
  }
});

router.get('/bottlenecks', async (req, res, next) => {
  try {
    res.json(await detectBottlenecks({ zoneName: parseZone(req.query) }));
  } catch (error) {
    next(error);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const status = req.query.status || 'active';
    const limit = Number(req.query.limit) || 100;
    const alerts = await listAlerts({ status, limit, severity: req.query.severity || null });
    res.json({
      data: { alerts },
      meta: {
        generatedAt: new Date().toISOString(),
        scope: 'chief',
        dataFreshness: 'current',
        rulesVersion: 'v4-supervision-draft',
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/alerts/:id/acknowledge', async (req, res, next) => {
  try {
    const row = await acknowledgeAlert(req.params.id, req.user);
    res.json({
      data: row,
      meta: { generatedAt: new Date().toISOString(), scope: 'chief' },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/capacity', async (req, res, next) => {
  try {
    res.json(await getSupervisionCapacity({ zoneName: parseZone(req.query) }));
  } catch (error) {
    next(error);
  }
});

router.get('/activity', async (req, res, next) => {
  try {
    res.json(await getSupervisionActivity({ limit: Number(req.query.limit) || 30 }));
  } catch (error) {
    next(error);
  }
});

router.get('/config', async (_req, res, next) => {
  try {
    const rules = await getEffectiveRules();
    res.json({
      data: { rules },
      meta: {
        generatedAt: new Date().toISOString(),
        scope: 'chief',
        rulesVersion: rules.rulesVersion,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/coordination', async (_req, res, next) => {
  try {
    const handoffs = await query(
      `SELECT hr.id, hr.visit_id, hr.status, hr.requested_at, hr.reason, v.public_code
       FROM handoff_requests hr
       JOIN visits v ON v.id = hr.visit_id
       WHERE hr.status = 'pending' AND v.closed_at IS NULL
       ORDER BY hr.requested_at ASC
       LIMIT 50`,
    );
    const transfers = await query(
      `SELECT tr.id, tr.visit_id, tr.status, tr.requested_at, v.public_code
       FROM transfer_requests tr
       JOIN visits v ON v.id = tr.visit_id
       WHERE tr.status = 'pending' AND v.closed_at IS NULL
       ORDER BY tr.requested_at ASC
       LIMIT 50`,
    );
    res.json({
      data: {
        pendingHandoffs: handoffs.rows.map((row) => ({
          id: Number(row.id),
          visitId: Number(row.visit_id),
          publicCode: row.public_code,
          requestedAt: row.requested_at,
          reason: row.reason,
        })),
        pendingTransfers: transfers.rows.map((row) => ({
          id: Number(row.id),
          visitId: Number(row.visit_id),
          publicCode: row.public_code,
          requestedAt: row.requested_at,
        })),
      },
      meta: { generatedAt: new Date().toISOString(), scope: 'chief' },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/evaluate-alerts', async (_req, res, next) => {
  try {
    await evaluateOperationalAlerts();
    res.json({
      data: { evaluated: true, evaluatedAt: getLastAlertEvaluationAt() },
      meta: { generatedAt: new Date().toISOString(), scope: 'chief' },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
