const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAllPrompts, updatePrompt, getDebugResolvedContext } = require('../controllers/ivaPromptsController');

// All routes require authentication
router.use(auth);

// GET /api/iva-prompts - List all prompts
router.get('/', getAllPrompts);

// GET /api/iva-prompts/debug-context - Get fully resolved context
router.get('/debug-context', getDebugResolvedContext);

// PUT /api/iva-prompts/:level - Update specific prompt
router.put('/:level', updatePrompt);

module.exports = router;
