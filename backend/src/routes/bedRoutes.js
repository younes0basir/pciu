const express = require('express');
const { getAvailableBeds } = require('../services/bedService');
const { authenticateJwt, requireCapability } = require('../middleware/auth');

const router = express.Router();

// GET /api/beds/available — roles with 'place' (nurse, chief)
router.get('/available', authenticateJwt, requireCapability('place'), async (req, res, next) => {
  try {
    const beds = await getAvailableBeds();
    res.json({ beds, count: beds.length });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
