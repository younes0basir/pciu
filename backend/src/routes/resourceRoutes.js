const express = require('express');
const { authenticateJwt, requireCapability, requireRole } = require('../middleware/auth');
const { attachActorContext, getActionContext } = require('../middleware/actorContext');
const {
  getResourceBoard,
  getResourceDetail,
  getResourceHistory,
  listEligibleResourcesForVisit,
  getCapacitySnapshot,
} = require('../services/resourceManagementService');
const {
  setOperationalStatus,
  confirmBedReady,
  markBedCleaning,
} = require('../services/resourceService');
const { listAlerts } = require('../services/operationalAlertService');

const router = express.Router();

router.use(authenticateJwt);
router.use(attachActorContext);

router.get('/board', requireRole('nurse', 'doctor', 'chief', 'receptionist'), async (_req, res, next) => {
  try {
    res.json(await getResourceBoard());
  } catch (error) {
    next(error);
  }
});

router.get('/capacity', requireRole('nurse', 'doctor', 'chief'), async (_req, res, next) => {
  try {
    res.json(await getCapacitySnapshot());
  } catch (error) {
    next(error);
  }
});

router.get('/eligible', requireCapability('place'), async (req, res, next) => {
  try {
    const visitId = req.query.visitId;
    if (!visitId) {
      return res.status(400).json({ error: 'visitId requis.' });
    }
    const staffedOnly = req.query.staffedOnly === 'true' || req.query.staffedOnly === '1';
    res.json(await listEligibleResourcesForVisit(visitId, { staffedOnly }));
  } catch (error) {
    next(error);
  }
});

router.get('/alerts', requireRole('nurse', 'doctor', 'chief'), async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    const all = await listAlerts({ status, limit: Number(req.query.limit) || 100 });
    const resourceTypes = new Set([
      'BED_TURNOVER_PENDING',
      'CAPACITY_BLOCK',
      'NO_READY_BED',
    ]);
    res.json({
      alerts: all.filter((a) => resourceTypes.has(a.alertType) || a.bedId != null),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:bedId/history', requireRole('nurse', 'doctor', 'chief'), async (req, res, next) => {
  try {
    res.json(
      await getResourceHistory(req.params.bedId, {
        limit: Number(req.query.limit) || 50,
        offset: Number(req.query.offset) || 0,
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.get('/:bedId', requireRole('nurse', 'doctor', 'chief'), async (req, res, next) => {
  try {
    res.json(await getResourceDetail(req.params.bedId));
  } catch (error) {
    next(error);
  }
});

router.post('/:bedId/mark-cleaning', requireCapability('place'), async (req, res, next) => {
  try {
    res.json(await markBedCleaning(req.params.bedId, req.body || {}, req.user));
  } catch (error) {
    next(error);
  }
});

router.post('/:bedId/confirm-ready', requireCapability('place'), async (req, res, next) => {
  try {
    res.json(
      await confirmBedReady(req.params.bedId, req.body || {}, req.user, getActionContext(req)),
    );
  } catch (error) {
    next(error);
  }
});

router.post('/:bedId/operational-status', requireCapability('place'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const operationalStatus = body.operationalStatus ?? body.status;
    res.json(
      await setOperationalStatus(
        req.params.bedId,
        { ...body, operationalStatus },
        req.user,
        getActionContext(req),
      ),
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
