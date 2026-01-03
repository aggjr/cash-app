const express = require('express');
const router = express.Router();
const fs = require('fs');
const fileLogger = require('../utils/fileLogger');

// Get Logs
router.get('/logs', (req, res) => {
    try {
        const logPath = fileLogger.getLogFilePath();
        if (fs.existsSync(logPath)) {
            const content = fs.readFileSync(logPath, 'utf8');
            res.header('Content-Type', 'text/plain');
            res.send(content);
        } else {
            res.send('Log file is empty or does not exist yet.');
        }
    } catch (error) {
        res.status(500).send('Error reading log file: ' + error.message);
    }
});

// Clear Logs
router.delete('/logs', (req, res) => {
    try {
        fileLogger.clear();
        res.send('Logs cleared.');
    } catch (error) {
        res.status(500).send('Error clearing logs: ' + error.message);
    }
});

module.exports = router;
