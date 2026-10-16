const express = require('express');
const {
  registerVisit,
  callVisit,
  placeVisit,
  startConsultation,
  updateConsultation,
  updateVisitPriority,
  closeVisit,
  returnVisit,
  getVisitDetails,
} = require('../services/visitService');
const { authenticateJwt, requireCapability } = require('../middleware/auth');
const { attachActorContext, getActionContext } = require('../middleware/actorContext');
const {
  lookupPatientForRegistration,
  getRegistrationHints,
  getRegistrationQueueContext,
} = require('../services/registrationIntelligenceService');

const router = express.Router();

// Apply JWT authentication to all visit routes
router.use(authenticateJwt);
router.use(attachActorContext);

router.get('/register/preflight', requireCapability('register'), async (req, res, next) => {
  try {
    const nationalId = req.query.nationalId || req.query.cin || '';
    const lookup = await lookupPatientForRegistration(nationalId);
    const queue = await getRegistrationQueueContext();
    res.json({
      ...lookup,
      queue,
      meta: { generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/register/hints', requireCapability('register'), async (req, res, next) => {
  try {
    const hints = getRegistrationHints({
      chiefComplaint: req.query.chiefComplaint || '',
      arrivalMode: req.query.arrivalMode || '',
      registrationPriority:
        req.query.registrationPriority != null && req.query.registrationPriority !== ''
          ? Number(req.query.registrationPriority)
          : null,
    });
    res.json({
      ...hints,
      meta: { generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/visits/:id - Patient Sheet details & event timeline
router.get('/:id', async (req, res, next) => {
  try {
    const details = await getVisitDetails(req.params.id);
    res.json(details);
  } catch (error) {
    next(error);
  }
});

// ACTION 1: register (— -> waiting)
// Capability: 'register' (receptionist)
router.post('/register', requireCapability('register'), async (req, res, next) => {
  try {
    const result = await registerVisit(req.body, req.user, getActionContext(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// ACTION 2: call (waiting -> waiting)
// Capability: 'call' (receptionist)
router.post('/:id/call', requireCapability('call'), async (req, res, next) => {
  try {
    const result = await callVisit(req.params.id, req.user, getActionContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ACTION 3: place (waiting -> placed)
// Capability: 'place' (nurse only; chief cannot place)
router.post('/:id/place', requireCapability('place'), async (req, res, next) => {
  try {
    const { bedId } = req.body;
    const result = await placeVisit(req.params.id, bedId, req.user, getActionContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ACTION 4: start (placed -> in_treatment)
// Capability: 'start' (doctor, nurse for room doctor)
router.post('/:id/start', requireCapability('start'), async (req, res, next) => {
  try {
    const result = await startConsultation(
      req.params.id,
      req.user,
      req.body || {},
      getActionContext(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Nurse validates / adjusts waiting priority (optional triage step).
router.patch('/:id/priority', requireCapability('triage'), async (req, res, next) => {
  try {
    const result = await updateVisitPriority(
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

// Fill or reattribute an open consultation (chief: any doctor; nurse: room doctor).
router.patch('/:id/consultation', requireCapability('fill'), async (req, res, next) => {
  try {
    const result = await updateConsultation(
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

// ACTION 5: close (placed/in_treatment -> discharged/transferred/left_without_seen)
// Capability: 'close' (doctor, nurse in room, chief)
router.post('/:id/close', requireCapability('close'), async (req, res, next) => {
  try {
    const result = await closeVisit(req.params.id, req.body, req.user, getActionContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ACTION 6: return (placed -> waiting)
// Capability: 'return' (nurse, chief)
router.post('/:id/return', requireCapability('return'), async (req, res, next) => {
  try {
    const result = await returnVisit(req.params.id, req.body, req.user, getActionContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
