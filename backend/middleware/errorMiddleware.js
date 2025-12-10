const db = require('../config/database');

let errorCache = {};

// Verify database path via server.js or check where it was imported. 
// Assuming ../config/database is correct based on overwrite. 

const loadErrorCatalog = async () => {
    try {
        const [rows] = await db.query('SELECT * FROM error_catalog');
        rows.forEach(row => {
            errorCache[row.code] = row;
        });
        console.log(`Error catalog loaded: ${rows.length} errors cached.`);
    } catch (error) {
        console.error('Failed to load error catalog:', error);
    }
};

const errorHandler = (err, req, res, next) => {
    // Default to 500 System Error
    let statusCode = 500;
    let errorCode = 'SYS-001';
    let message = 'Erro interno do servidor.';
    let details = null;

    if (err.isOperational && err.code) {
        const catalogEntry = errorCache[err.code];
        if (catalogEntry) {
            statusCode = catalogEntry.http_status;
            errorCode = catalogEntry.code;
            message = catalogEntry.message;
        } else {
            console.warn(`Error code ${err.code} not found in catalog.`);
            errorCode = err.code;
            message = 'Erro não catalogado.';
            statusCode = 400; // Default for operational but unknown errors
        }
        details = err.details;
    } else {
        // Unexpected errors
        console.error('Unexpected Error:', err);
        // If it's a known non-operational error (like DB connection)
        if (err.code === 'ECONNREFUSED') {
            errorCode = 'DB-001';
            const dbErr = errorCache['DB-001'];
            if (dbErr) {
                statusCode = dbErr.http_status;
                message = dbErr.message;
            }
        }
    }

    res.status(statusCode).json({
        error: {
            code: errorCode,
            message: message,
            details: details,
            timestamp: new Date().toISOString()
        }
    });
};

module.exports = {
    errorHandler,
    loadErrorCatalog
};
