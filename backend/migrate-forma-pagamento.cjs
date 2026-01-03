const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db',
            multipleStatements: true
        });

        console.log('Using database:', process.env.DB_NAME || 'cash_db');

        const sqlPath = path.join(__dirname, '../database/add-forma-pagamento.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon and filter empty lines
        const queries = sqlContent
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0);

        console.log(`Found ${queries.length} queries to execute.`);

        for (const query of queries) {
            console.log(`Executing: ${query.substring(0, 50)}...`);
            try {
                await connection.query(query);
            } catch (err) {
                // Ignore "Duplicate column name" error (1060)
                if (err.errno === 1060) {
                    console.log('  -> Column already exists, skipping.');
                } else {
                    throw err;
                }
            }
        }

        console.log('✓ Migration completed: forma_pagamento column added.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

runMigration();
