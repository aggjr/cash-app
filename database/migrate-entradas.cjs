const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function runMigration() {
    let connection;
    try {
        console.log('Connecting to database...');
        console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
        console.log(`User: ${process.env.DB_USER || 'root'}`);

        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db',
            multipleStatements: true
        });

        console.log('✓ Connected to database');

        // Read and execute the SQL file
        const sqlPath = path.join(__dirname, 'add-entradas-table.sql');
        console.log(`Reading SQL from: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing query...');
        await connection.query(sql);
        console.log('✓ Migration completed successfully!');
        console.log('✓ Table "entradas" created (if it did not exist)');
    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

runMigration();
