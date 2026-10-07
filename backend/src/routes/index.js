const express = require('express');
const authRoutes = require('./authRoutes');
const boardRoutes = require('./boardRoutes');
const visitRoutes = require('./visitRoutes');
const bedRoutes = require('./bedRoutes');
const userRoutes = require('./userRoutes');
const chiefRoutes = require('./chiefRoutes');
const clinicianRoutes = require('./clinicianRoutes');

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

module.exports = router;
