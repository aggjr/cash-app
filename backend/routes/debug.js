const express = require('express');
const router = express.Router();
const fs = require('fs');
const fileLogger = require('../utils/fileLogger');
const db = require('../config/database');

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

// FORCE FIX: Delete 'Ariana' and its blockers
router.get('/fix-ariana', async (req, res) => {
    const resultLog = [];
    try {
        resultLog.push('Starting Force-Delete for "Ariana"...');

        // 1. Find the type(s)
        const [types] = await db.query(
            'SELECT * FROM tipo_entrada WHERE label LIKE "%Ariana%"'
        );

        if (types.length === 0) {
            resultLog.push('No tipo_entrada found with name containing "Ariana".');
            return res.json({ message: 'Nothing found', log: resultLog });
        }

        for (const type of types) {
            resultLog.push(`Processing Type ID: ${type.id} ("${type.label}")`);

            // 2. Delete entries referencing this type (The blockers)
            const [delEntries] = await db.query(
                'DELETE FROM entradas WHERE tipo_entrada_id = ?',
                [type.id]
            );
            resultLog.push(`- Deleted ${delEntries.affectedRows} referencing entries from 'entradas'.`);

            // 3. Delete any child types (Though CASCADE handling usually does this, we force it)
            const [delChildren] = await db.query(
                'DELETE FROM tipo_entrada WHERE parent_id = ?',
                [type.id]
            );
            if (delChildren.affectedRows > 0) {
                resultLog.push(`- Deleted ${delChildren.affectedRows} child types.`);
            }

            // 4. Delete the type itself
            const [delType] = await db.query(
                'DELETE FROM tipo_entrada WHERE id = ?',
                [type.id]
            );
            resultLog.push(`- Deleted Type ID ${type.id}. Status: Success.`);
        }

        resultLog.push('Operation Complete.');
        res.json({ success: true, log: resultLog });

    } catch (error) {
        console.error(error);
        resultLog.push(`ERROR: ${error.message}`);
        res.status(500).json({ success: false, error: error.message, log: resultLog });
    }
});

module.exports = router;
