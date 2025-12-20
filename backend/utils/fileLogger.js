const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
const logFile = path.join(logDir, 'db-debug.log');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const fileLogger = {
    log: (message, data = null) => {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] ${message}`;

        if (data) {
            try {
                if (typeof data === 'object') {
                    logMessage += '\n' + JSON.stringify(data, null, 2);
                } else {
                    logMessage += '\n' + String(data);
                }
            } catch (err) {
                logMessage += '\n[Error serializing data]';
            }
        }

        logMessage += '\n' + '-'.repeat(80) + '\n';

        try {
            fs.appendFileSync(logFile, logMessage);
        } catch (err) {
            console.error('Failed to write to file log:', err);
        }
    },

    getLogFilePath: () => logFile,

    clear: () => {
        try {
            fs.writeFileSync(logFile, '');
        } catch (err) {
            console.error('Failed to clear log file:', err);
        }
    }
};

module.exports = fileLogger;
