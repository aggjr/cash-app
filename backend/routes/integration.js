const express = require('express');
const router = express.Router();
const evolutionService = require('../services/evolutionService');
const fileLogger = require('../utils/fileLogger');
const auth = require('../middleware/auth'); // Optional: protect these routes

// Send WhatsApp Message
router.post('/whatsapp/send', auth, async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message are required' });
        }

        const result = await evolutionService.sendMessage(phone, message);
        res.json({ success: true, data: result });
    } catch (error) {
        fileLogger.log(`API Error sending WhatsApp: ${error.message}`);
        res.status(500).json({ error: 'Failed to send WhatsApp message', details: error.message });
    }
});

// Check WhatsApp Status
router.get('/whatsapp/status', auth, async (req, res) => {
    try {
        const status = await evolutionService.getConnectionStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        fileLogger.log(`API Error checking WhatsApp status: ${error.message}`);
        res.status(500).json({ error: 'Failed to get WhatsApp status', details: error.message });
    }
});

module.exports = router;
