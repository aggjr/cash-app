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
    let sqlError = null;

    if (err.isOperational && err.code) {
        const catalogEntry = errorCache[err.code];
        if (catalogEntry) {
            statusCode = catalogEntry.http_status;
            errorCode = catalogEntry.code;
            // Prefer specific details if provided (as string), otherwise use generic catalog message
            const specificMessage = (err.details && typeof err.details === 'string') ? err.details : null;
            message = specificMessage || catalogEntry.message;
        } else {
            console.warn(`Error code ${err.code} not found in catalog.`);
            errorCode = err.code;
            message = 'Erro não catalogado.';
            statusCode = 400; // Default for operational but unknown errors
        }
        details = err.details;
    } else {
        // Unexpected errors - Include SQL details for debugging
        console.error('Unexpected Error:', err);

        // Extract SQL error details
        if (err.code) {
            sqlError = {
                sqlCode: err.code,
                sqlState: err.sqlState,
                sqlMessage: err.sqlMessage || err.message,
                sql: err.sql?.substring(0, 500) // First 500 chars of SQL for debugging
            };
        }

        // Use actual error message instead of generic
        message = err.message || 'Erro interno do servidor.';

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
            sqlError: sqlError,
            stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
            timestamp: new Date().toISOString()
        }
    });
};

module.exports = {
    errorHandler,
    loadErrorCatalog
};
