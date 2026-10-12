const express = require('express');
const { authenticateJwt, requireCapability } = require('../middleware/auth');
const { attachActorContext, getActionContext } = require('../middleware/actorContext');
const {
  startObservation,
  endObservation,
  decideDisposition,
  completeVisit,
} = require('../services/careService');
const { recordTriage, setCriticalFlag, listTriageHistory } = require('../services/triageService');
const { transferResource, setOperationalStatus } = require('../services/resourceService');
const { calculateLoad } = require('../services/capacityService');
const {
  listExamsForVisit,
  listTasksForVisit,
  requestExam,
  completeExam,
  createCareTask,
  EXAM_TYPES,
} = require('../services/examTaskService');

const router = express.Router();

router.use(authenticateJwt);
router.use(attachActorContext);

router.get('/capacity', async (req, res, next) => {
  try {
    res.json(await calculateLoad());
  } catch (error) {
    next(error);
  }
});

router.get('/visits/:id/exams', async (req, res, next) => {
  try {
    res.json(await listExamsForVisit(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.get('/visits/:id/tasks', async (req, res, next) => {
  try {
    res.json(await listTasksForVisit(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:id/exams', requireCapability('fill'), async (req, res, next) => {
  try {
    const result = await requestExam(
      req.params.id,
      req.body || {},
      req.user,
      getActionContext(req),
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/exams/:examId/complete', requireCapability('fill'), async (req, res, next) => {
  try {
    const result = await completeExam(
      req.params.examId,
      req.body || {},
      req.user,
      getActionContext(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:id/tasks', requireCapability('fill'), async (req, res, next) => {
  try {
    const result = await createCareTask(
      req.params.id,
      req.body || {},
      req.user,
      getActionContext(req),
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/exam-types', (_req, res) => {
  res.json({ types: EXAM_TYPES });
});

router.get('/visits/:id/triage-history', async (req, res, next) => {
  try {
    res.json(await listTriageHistory(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:id/triage', requireCapability('triage'), async (req, res, next) => {
  try {
    const result = await recordTriage(
      req.params.id,
      req.body || {},
      req.user,
      getActionContext(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:id/critical', requireCapability('critical'), async (req, res, next) => {
  try {
    const result = await setCriticalFlag(
      req.params.id,
      req.body || {},
      req.user,
      getActionContext(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:id/observation/start', requireCapability('start'), async (req, res, next) => {
  try {
    const result = await startObservation(req.params.id, req.user, getActionContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:id/observation/end', requireCapability('start'), async (req, res, next) => {
  try {
    const result = await endObservation(req.params.id, req.user, getActionContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:id/disposition', requireCapability('close'), async (req, res, next) => {
  try {
    const result = await decideDisposition(
      req.params.id,
      req.body || {},
      req.user,
      getActionContext(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:id/complete', requireCapability('close'), async (req, res, next) => {
  try {
    const result = await completeVisit(
      req.params.id,
      req.body || {},
      req.user,
      getActionContext(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/visits/:id/transfer', requireCapability('place'), async (req, res, next) => {
  try {
    const { bedId } = req.body || {};
    const result = await transferResource(
      req.params.id,
      bedId,
      req.user,
      getActionContext(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch('/resources/:bedId/status', requireCapability('place'), async (req, res, next) => {
  try {
    const result = await setOperationalStatus(
      req.params.bedId,
      req.body || {},
      req.user,
      getActionContext(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
