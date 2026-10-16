const express = require('express');
const { authenticateJwt, requireCapability, requireRole } = require('../middleware/auth');
const { attachActorContext, getActionContext } = require('../middleware/actorContext');
const { getSupervisionSnapshot, computeRecommendationsForVisit } = require('../services/workflowOrchestratorService');
const {
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
} = require('../services/operationalAlertService');
const {
  createTransferRequest,
  confirmTransferRequest,
  cancelTransferRequest,
} = require('../services/transferRequestService');
const {
  createHandoffRequest,
  respondHandoffRequest,
  listHandoffsForVisit,
} = require('../services/handoffService');
const { getReassessmentIntervalMinutes, updateSetting } = require('../services/workflowSettingsService');
const { getResourceBoard } = require('../services/resourceManagementService');

const router = express.Router();

router.use(authenticateJwt);
router.use(attachActorContext);

router.get('/supervision', requireRole('chief'), async (_req, res, next) => {
  try {
    res.json(await getSupervisionSnapshot());
  } catch (error) {
    next(error);
  }
});

router.get('/visits/:visitId/recommendations', async (req, res, next) => {
  try {
    const recommendations = await computeRecommendationsForVisit(req.params.visitId);
    res.json({ visitId: Number(req.params.visitId), recommendations });
  } catch (error) {
    next(error);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    res.json({ alerts: await listAlerts({ status, limit: Number(req.query.limit) || 100 }) });
  } catch (error) {
    next(error);
  }
});

router.post('/alerts/:id/acknowledge', requireRole('chief', 'nurse'), async (req, res, next) => {
  try {
    res.json(await acknowledgeAlert(req.params.id, req.user));
  } catch (error) {
    next(error);
  }
});

router.post('/alerts/:id/resolve', requireRole('chief', 'nurse'), async (req, res, next) => {
  try {
    res.json(await resolveAlert(req.params.id, req.user, req.body || {}));
  } catch (error) {
    next(error);
  }
});

router.get('/resources/board', async (_req, res, next) => {
  try {
    const board = await getResourceBoard();
    res.json({
      ...board,
      resources: board.resources,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/settings/reassessment-minutes', async (_req, res, next) => {
  try {
    res.json({ reassessmentIntervalMinutes: await getReassessmentIntervalMinutes() });
  } catch (error) {
    next(error);
  }
});

router.put('/settings/reassessment-minutes', requireRole('chief', 'admin'), async (req, res, next) => {
  try {
    const minutes = Number(req.body?.minutes);
    if (!Number.isFinite(minutes) || minutes < 15) {
      return res.status(400).json({ error: 'minutes doit être >= 15.' });
    }
    await updateSetting('reassessment_interval_minutes', minutes, req.user);
    res.json({ reassessmentIntervalMinutes: minutes });
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:visitId/transfer-requests', requireCapability('place'), async (req, res, next) => {
  try {
    const bedId = req.body?.bedId || req.body?.toBedId;
    const result = await createTransferRequest(
      req.params.visitId,
      bedId,
      req.user,
      getActionContext(req),
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/transfers/:id/confirm', requireCapability('place'), async (req, res, next) => {
  try {
    res.json(await confirmTransferRequest(req.params.id, req.user, getActionContext(req)));
  } catch (error) {
    next(error);
  }
});

router.post('/transfers/:id/cancel', requireCapability('place'), async (req, res, next) => {
  try {
    res.json(
      await cancelTransferRequest(req.params.id, req.user, req.body || {}, getActionContext(req)),
    );
  } catch (error) {
    next(error);
  }
});

router.get('/visits/:visitId/handoffs', async (req, res, next) => {
  try {
    res.json({ handoffs: await listHandoffsForVisit(req.params.visitId) });
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:visitId/handoffs', requireCapability('fill'), async (req, res, next) => {
  try {
    res.status(201).json(await createHandoffRequest(req.params.visitId, req.body, req.user));
  } catch (error) {
    next(error);
  }
});

router.post('/handoffs/:id/respond', async (req, res, next) => {
  try {
    const accept = Boolean(req.body?.accept);
    res.json(await respondHandoffRequest(req.params.id, accept, req.user, req.body || {}));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
