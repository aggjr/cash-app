const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Get projects by email (for login flow)
router.post('/projects-by-email', authController.getProjectsByEmail);

// Password change (auth required)
router.post('/change-password', auth, authController.changePassword);

module.exports = router;
