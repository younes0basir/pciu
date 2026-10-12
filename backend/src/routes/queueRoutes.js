const express = require('express');
const { authenticateJwt } = require('../middleware/auth');
const { getAllWorklists } = require('../services/queueService');

const router = express.Router();

router.use(authenticateJwt);

router.get('/worklists', async (req, res, next) => {
  try {
    const reassessmentMinutes = req.query.reassessmentMinutes
      ? Number(req.query.reassessmentMinutes)
      : undefined;
    const data = await getAllWorklists({ maxMinutesSinceTriage: reassessmentMinutes });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
