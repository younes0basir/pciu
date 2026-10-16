const express = require('express');
const { authenticateJwt, requireRole } = require('../middleware/auth');
const { getChiefOverview } = require('../services/chiefService');
const { getPatientAnalytics } = require('../services/patientAnalyticsService');
const { assignRoomTeam, clearRoomTeam, getStaffBoard } = require('../services/staffService');
const chiefSupervisionRoutes = require('./chiefSupervisionRoutes');

const router = express.Router();

router.use(authenticateJwt, requireRole('chief'));
router.use('/supervision', chiefSupervisionRoutes);

// GET /api/chief/overview — pipeline board + KPIs for chef de service
router.get('/overview', async (_req, res, next) => {
  try {
    const overview = await getChiefOverview();
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

// GET /api/chief/analytics/patients — aggregated patient KPIs, no identifiers
router.get('/analytics/patients', async (req, res, next) => {
  try {
    const analytics = await getPatientAnalytics(req.query.period);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

// GET /api/chief/teams — rooms with the doctor and nurses charged to each one
router.get('/teams', async (_req, res, next) => {
  try {
    const board = await getStaffBoard();
    res.json(board);
  } catch (error) {
    next(error);
  }
});

// PUT /api/chief/rooms/:roomId/team — set the responsible clinician and linked nurses
router.put('/rooms/:roomId/team', async (req, res, next) => {
  try {
    const board = await assignRoomTeam(req.params.roomId, req.body, req.user);
    res.json(board);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/chief/rooms/:roomId/team — release the room
router.delete('/rooms/:roomId/team', async (req, res, next) => {
  try {
    const board = await clearRoomTeam(req.params.roomId);
    res.json(board);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
