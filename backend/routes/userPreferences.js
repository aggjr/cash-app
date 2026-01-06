const express = require('express');
const router = express.Router();
const userPreferencesController = require('../controllers/userPreferencesController');
const auth = require('../middleware/auth');

// Get all preferences for current user
router.get('/', auth, userPreferencesController.getAllPreferences);

// Get specific preference by key
router.get('/:key', auth, userPreferencesController.getPreference);

// Set/update preference
router.post('/:key', auth, userPreferencesController.setPreference);

// Delete preference
router.delete('/:key', auth, userPreferencesController.deletePreference);

module.exports = router;
