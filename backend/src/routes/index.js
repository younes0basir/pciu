const express = require('express');
const authRoutes = require('./authRoutes');
const boardRoutes = require('./boardRoutes');
const visitRoutes = require('./visitRoutes');
const bedRoutes = require('./bedRoutes');
const userRoutes = require('./userRoutes');
const chiefRoutes = require('./chiefRoutes');
const clinicianRoutes = require('./clinicianRoutes');
const eventStreamRoutes = require('./eventStreamRoutes');
const metricsRoutes = require('./metricsRoutes');
const adminDemoRoutes = require('./adminDemoRoutes');
const queueRoutes = require('./queueRoutes');
const careRoutes = require('./careRoutes');

const router = express.Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'picu-backend',
    timestamp: new Date().toISOString(),
  });
});

// Mount modules
router.use('/auth', authRoutes);
router.use('/board', boardRoutes);
router.use('/visits', visitRoutes);
router.use('/beds', bedRoutes);
router.use('/users', userRoutes);
router.use('/chief', chiefRoutes);
router.use('/clinician', clinicianRoutes);
router.use('/events', eventStreamRoutes);
router.use('/metrics', metricsRoutes);
router.use('/admin', adminDemoRoutes);
router.use('/queue', queueRoutes);
router.use('/care', careRoutes);

module.exports = router;
