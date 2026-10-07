const express = require('express');
const { authenticateJwt, requireRole } = require('../middleware/auth');
const { getClinicianWorkspace } = require('../services/clinicianService');

const router = express.Router();

router.use(authenticateJwt, requireRole('doctor', 'nurse'));

router.get('/workspace', async (req, res, next) => {
  try {
    const workspace = await getClinicianWorkspace(req.user);
    res.json(workspace);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
