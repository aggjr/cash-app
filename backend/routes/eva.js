const express = require('express');
const router = express.Router();
const evaController = require('../controllers/evaControllerV2');
const { authenticate } = require('../middleware/auth');

console.log('🔍 DEBUG evaController:', evaController);
console.log('🔍 DEBUG evaController.chat:', evaController.chat);
console.log('🔍 DEBUG typeof evaController.chat:', typeof evaController.chat);

// POST /api/eva/chat - Chat with EVA using LLM
router.post('/chat', authenticate, evaController.chat);

module.exports = router;
