const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool - TCP/IP configuration for Windows
const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'cash_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test connection (lazy - will connect on first query)
// Removed synchronous test to prevent server from exiting on slow connections
// pool.getConnection()
//     .then(connection => {
//         console.log('✓ Database connected successfully');
//         connection.release();
//     })
//     .catch(err => {
//         console.error('✗ Database connection failed:', err.message);
//         process.exit(1);
//     });

module.exports = pool;
