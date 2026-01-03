const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// PUT /api/users/:userId - Update user profile
router.put('/:userId', userController.updateUserProfile);

module.exports = router;
