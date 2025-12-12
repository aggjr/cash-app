
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true // Important for init.sql
};

async function runReset() {
    let conn;
    try {
        console.log('Read init.sql...');
        // Path adjusted to be inside the container (same dir as this script)
        const initSqlPath = path.join(__dirname, 'init.sql');
        const sql = fs.readFileSync(initSqlPath, 'utf8');

        conn = await mysql.createConnection(dbConfig);
        console.log('Connected to DB. Executing reset...');

        // Execute the entire script
        await conn.query(sql);

        console.log('Database reset successfully!');
    } catch (e) {
        console.error('Reset failed:', e);
    } finally {
        if (conn) await conn.end();
    }
}

runReset();
