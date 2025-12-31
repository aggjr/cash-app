const express = require('express');
const router = express.Router();
const evaController = require('../controllers/evaControllerV2');
const { authenticate } = require('../middleware/auth');

console.log('🔍 DEBUG evaController:', evaController);
console.log('🔍 DEBUG evaController.chat:', evaController.chat);
console.log('🔍 DEBUG typeof evaController.chat:', typeof evaController.chat);
console.log('🔍 DEBUG authenticate:', authenticate);
console.log('🔍 DEBUG typeof authenticate:', typeof authenticate);

// POST /api/eva/chat - Chat with EVA using LLM (TEMP: without auth for testing)
router.post('/chat', evaController.chat);

module.exports = router;
