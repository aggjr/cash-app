const express = require('express');
const router = express.Router();
const evaController = require('../controllers/evaControllerV2');
const auth = require('../middleware/auth');

// POST /api/eva/chat - Chat with EVA using LLM
router.post('/chat', auth, evaController.chat);

// POST /api/eva/operate - Decide operational action (Navigate, Click, Fill)
router.post('/operate', auth, evaController.operate);

// Include tracking routes
const evaTracking = require('./evaTracking');
router.use('/', evaTracking);

module.exports = router;
