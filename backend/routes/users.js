const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// All routes require authentication
const authMiddleware = auth;

// PUT /api/users/:userId - Update user profile
router.put('/:userId', authMiddleware, userController.updateUserProfile);

// DELETE /api/users/:userId - Smart delete user (hard delete if no deps, soft delete otherwise)
router.delete('/:userId', authMiddleware, userController.deleteUser);

module.exports = router;
