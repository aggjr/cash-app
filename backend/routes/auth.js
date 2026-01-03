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

// Update user preference (auth required)
router.put('/update-preference', auth, authController.updatePreference);

//Detect gender from name using LLM (auth required)
router.post('/detect-gender', auth, authController.detectGender);

module.exports = router;
