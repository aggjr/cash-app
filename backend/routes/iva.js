const express = require('express');
const router = express.Router();
const ivaController = require('../controllers/ivaControllerV2');
const auth = require('../middleware/auth');

// POST /api/IVA/chat - Chat with IVA using LLM
router.post('/chat', auth, ivaController.chat);

// POST /api/IVA/operate - Decide operational action (Navigate, Click, Fill)
router.post('/operate', auth, ivaController.operate);

// Include tracking routes
const ivaTracking = require('./ivaTracking');
router.use('/', ivaTracking);

module.exports = router;

