const mysql = require('mysql2/promise');
const { auditedQuery } = require('../utils/auditedDatabase');
require('dotenv').config();

// Create connection pool - TCP/IP configuration for Windows
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'cash_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // CRITICAL: Force dates to be returned as strings to prevent timezone conversion
    dateStrings: true, // Returns DATE/DATETIME as 'YYYY-MM-DD' strings, not Date objects
    timezone: 'Z' // Use UTC to prevent automatic timezone conversions
});

// Wrapper for pool.query that includes audit logging
const poolQueryWithAudit = async (sql, params, req) => {
    return auditedQuery(pool, sql, params, req);
};

// Export both methods
module.exports = {
    // Standard pool methods (backward compatibility)
    query: pool.query.bind(pool),
    getConnection: pool.getConnection.bind(pool),

    // NEW: Audited query (use this for all mutations)
    auditedQuery: poolQueryWithAudit,

    // Direct pool access if needed
    pool: pool
};
