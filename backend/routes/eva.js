const express = require('express');
const router = express.Router();
const evaController = require('../controllers/evaControllerV2');
const auth = require('../middleware/auth');

// POST /api/eva/chat - Chat with EVA using LLM
router.post('/chat', auth, evaController.chat);

module.exports = router;
