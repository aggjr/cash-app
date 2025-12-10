const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function runMigration() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db',
            multipleStatements: true
        });

        console.log('✓ Connected to database');

        // Read and execute the SQL file
        const sql = fs.readFileSync(path.join(__dirname, 'add-entradas-table.sql'), 'utf8');

        await connection.query(sql);
        console.log('✓ Migration completed successfully!');
        console.log('✓ Table "entradas" created');
    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

runMigration();
