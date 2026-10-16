const express = require('express');
const nim = require('../ai/providers/nim/nim.provider');
const { authenticateJwt, requireCapability, requireRole } = require('../middleware/auth');
const {
  getEffectiveAiSettings,
  patchServiceAiSettings,
  describeAgentAvailability,
} = require('../services/aiSettingsService');
const { listRecommendations, updateRecommendationStatus } = require('../ai/observability/ai-audit');
const { generateDocumentationSummary } = require('../ai/agents/documentation-agent');
const { recommendTriage } = require('../ai/agents/triage-agent');
const { recommendBedFlow } = require('../ai/agents/bed-flow-agent');
const { analyzeCapacity } = require('../ai/agents/capacity-agent');
const {
  planPipelinePlacement,
  applyPipelinePlacement,
} = require('../services/pipelinePlacementService');
const { getActionContext } = require('../middleware/actorContext');
const { approveAndExecute, rejectApproval } = require('../ai/actions/action-gateway');
const { routeIntent, synthesizeVisit, getRunSummary } = require('../ai/orchestrator/supervisor');
const { searchProtocolChunks } = require('../services/protocolRagService');
const { query } = require('../config/db');
const { assertAiRouteAllowed } = require('../ai/safety/ai-route-guard');

const router = express.Router();

router.get('/health', authenticateJwt, requireCapability('ai_health'), async (_req, res) => {
  const settings = await getEffectiveAiSettings();
  const nimHealth = await nim.health();
  res.json({
    ...nimHealth,
    effectiveMode: settings.effectiveMode,
    platformEnabled: settings.platformEnabled,
  });
});

router.get('/status', authenticateJwt, async (_req, res) => {
  const settings = await getEffectiveAiSettings();
  res.json({
    platformEnabled: settings.platformEnabled,
    serviceEnabled: settings.serviceEnabled,
    effectiveMode: settings.effectiveMode,
    agentFlags: settings.agentFlags,
    documentationHint: describeAgentAvailability(settings, 'documentation'),
    triageHint: describeAgentAvailability(settings, 'triage'),
  });
});

router.get('/settings', authenticateJwt, requireCapability('ai_settings'), async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const settings = await getEffectiveAiSettings();
  res.json(settings);
});

router.patch('/settings', authenticateJwt, requireCapability('ai_settings'), async (req, res, next) => {
  try {
    const settings = await patchServiceAiSettings(
      {
        mode: req.body?.mode,
        serviceEnabled: req.body?.serviceEnabled,
        agentFlags: req.body?.agentFlags,
      },
      req.user,
    );
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.get('/runs/:id', authenticateJwt, requireCapability('ai_health'), async (req, res, next) => {
  try {
    const summary = await getRunSummary(req.params.id);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.get('/recommendations', authenticateJwt, async (req, res, next) => {
  try {
    const visitId = req.query.visitId != null ? Number(req.query.visitId) : undefined;
    const status = req.query.status;
    const items = await listRecommendations({ visitId, status, limit: 30 });
    res.json({ recommendations: items });
  } catch (error) {
    next(error);
  }
});

router.patch('/recommendations/:id', authenticateJwt, async (req, res, next) => {
  try {
    const { status, humanDecision } = req.body || {};
    if (!['accepted', 'modified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const updated = await updateRecommendationStatus(req.params.id, {
      status,
      reviewedBy: req.user.id,
      humanDecision,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/documentation/summary',
  authenticateJwt,
  requireCapability('ai_documentation'),
  async (req, res, next) => {
    try {
      const visitId = Number(req.body?.visitId);
      if (!Number.isFinite(visitId)) {
        return res.status(400).json({ error: 'visitId required.' });
      }
      await assertAiRouteAllowed(req, { visitId });
      const result = await generateDocumentationSummary(visitId);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/triage/recommend',
  authenticateJwt,
  requireCapability('ai_triage_recommend'),
  async (req, res, next) => {
    try {
      const visitId = Number(req.body?.visitId);
      const shadow = Boolean(req.body?.shadow);
      if (!Number.isFinite(visitId)) {
        return res.status(400).json({ error: 'visitId required.' });
      }
      await assertAiRouteAllowed(req, { visitId });
      const result = await recommendTriage(visitId, { shadow });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/bed-flow/recommend',
  authenticateJwt,
  requireCapability('ai_bed_flow'),
  async (req, res, next) => {
    try {
      const visitId = Number(req.body?.visitId);
      if (!Number.isFinite(visitId)) {
        return res.status(400).json({ error: 'visitId required.' });
      }
      await assertAiRouteAllowed(req, { visitId });
      const result = await recommendBedFlow(visitId);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/bed-flow/pipeline/plan',
  authenticateJwt,
  requireRole('chief'),
  async (_req, res, next) => {
    try {
      const plan = await planPipelinePlacement();
      res.status(201).json(plan);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/bed-flow/pipeline/apply',
  authenticateJwt,
  requireRole('chief'),
  async (req, res, next) => {
    try {
      const result = await applyPipelinePlacement(req.user, getActionContext(req), req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/capacity/analyze',
  authenticateJwt,
  requireCapability('ai_capacity'),
  async (_req, res, next) => {
    try {
      const result = await analyzeCapacity();
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/supervisor/route',
  authenticateJwt,
  requireRole('chief'),
  async (req, res, next) => {
    try {
      const result = await routeIntent({
        intent: req.body?.intent,
        visitId: req.body?.visitId != null ? Number(req.body.visitId) : undefined,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/supervisor/visits/:visitId',
  authenticateJwt,
  requireRole('chief', 'admin'),
  async (req, res, next) => {
    try {
      const result = await synthesizeVisit(Number(req.params.visitId));
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/protocols/search',
  authenticateJwt,
  requireCapability('ai_triage_recommend'),
  async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      const results = await searchProtocolChunks(q, { limit: 8 });
      res.json({ results });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/approvals/:id/approve', authenticateJwt, async (req, res, next) => {
  try {
    const result = await approveAndExecute(req.params.id, req.user, {
      comment: req.body?.comment,
      actionContext: {
        agentRunId: req.body?.agentRunId,
        idempotencyKey: req.headers['idempotency-key'],
      },
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/approvals/:id/reject', authenticateJwt, async (req, res, next) => {
  try {
    const approval = await rejectApproval(req.params.id, req.user, {
      comment: req.body?.comment,
    });
    res.json(approval);
  } catch (error) {
    next(error);
  }
});

router.get('/shadow/export', authenticateJwt, requireRole('chief', 'admin'), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT ar.visit_id,
              ar.payload_json->>'suggested_priority' AS ai_priority,
              ar.confidence,
              v.priority AS human_priority,
              ar.created_at
       FROM agent_recommendations ar
       JOIN agent_runs r ON r.id = ar.agent_run_id
       JOIN visits v ON v.id = ar.visit_id
       WHERE ar.recommendation_type = 'triage'
         AND r.agent_type = 'triage_shadow'
       ORDER BY ar.created_at DESC
       LIMIT 500`,
    );
    res.json({ rows: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
