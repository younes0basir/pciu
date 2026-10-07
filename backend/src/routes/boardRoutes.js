const express = require('express');
const { getBoardSnapshot } = require('../services/boardService');
const { authenticateJwt } = require('../middleware/auth');

const router = express.Router();

// GET /api/board
router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const snapshot = await getBoardSnapshot(req.user);
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
