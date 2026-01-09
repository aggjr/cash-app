const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAllPrompts, updatePrompt } = require('../controllers/ivaPromptsController');

// All routes require authentication
router.use(auth);

// GET /api/iva-prompts - List all prompts
router.get('/', getAllPrompts);

// PUT /api/iva-prompts/:level - Update specific prompt
router.put('/:level', updatePrompt);

module.exports = router;
