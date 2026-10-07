const express = require('express');
const {
  login,
  register,
  getProfile,
  validateTempToken,
  setupPasswordWithToken,
} = require('../services/authService');
const { authenticateJwt } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await login(email, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/validate-temp-token
router.get('/validate-temp-token', async (req, res, next) => {
  try {
    const token = req.query.token;
    const result = await validateTempToken(token);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/setup-password
router.post('/setup-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const result = await setupPasswordWithToken(token, newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const result = await register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticateJwt, async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id);
    res.json({ user: profile });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ status: 'ok', message: 'Logged out successfully.' });
});

module.exports = router;
