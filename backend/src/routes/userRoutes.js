const express = require('express');
const {
  listUsers,
  getUserStats,
  createUser,
  updateUser,
  generateTempTokenForUser,
  deleteUser,
} = require('../services/userService');
const { authenticateJwt, requireRole } = require('../middleware/auth');

const router = express.Router();

// All user management routes require admin role
router.use(authenticateJwt, requireRole('admin'));

// GET /api/users/stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getUserStats();
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users, count: users.length });
  } catch (error) {
    next(error);
  }
});

// POST /api/users (Create user with temporary token, no password given by admin)
router.post('/', async (req, res, next) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json({
      user,
      tempToken: user.tempToken,
      tempTokenExpiresAt: user.tempTokenExpiresAt,
      message: 'Compte créé avec succès. Un jeton d’activation a été généré.',
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/:id/temp-token (Generate or regenerate temporary access token)
router.post('/:id/temp-token', async (req, res, next) => {
  try {
    const result = await generateTempTokenForUser(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/users/:id/reset-password (Aliases temp token generation for security)
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const result = await generateTempTokenForUser(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await deleteUser(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
