const express = require('express');
const router = express.Router();
const evaController = require('../controllers/evaController');
const { authenticate } = require('../middleware/auth');

// POST /api/eva/chat - Chat with EVA using LLM
router.post('/chat', authenticate, evaController.chat);

module.exports = router;
