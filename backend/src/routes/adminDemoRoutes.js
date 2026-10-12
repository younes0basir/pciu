const express = require('express');

const { authenticateJwt, requireRole } = require('../middleware/auth');
const {
  countDemoArrivals,
  createDemoArrivals,
  deleteDemoArrivals,
} = require('../services/demoArrivalService');

const router = express.Router();

router.use(authenticateJwt, requireRole('admin'));

router.get('/demo-arrivals', async (_req, res, next) => {
  try {
    const summary = await countDemoArrivals();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.post('/demo-arrivals', async (req, res, next) => {
  try {
    const result = await createDemoArrivals(req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/demo-arrivals', async (_req, res, next) => {
  try {
    const result = await deleteDemoArrivals();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
