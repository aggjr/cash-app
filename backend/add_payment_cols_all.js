const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const tables = [
    'saidas',
    'aportes',
    'retiradas',
    'transferencias',
    'producao_revenda',
    'entradas'
];

async function addColumns() {
    let connection;
    try {
        console.log('Connecting to DB...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        for (const table of tables) {
            console.log(`Checking table: ${table}`);
            try {
                await connection.query(`ALTER TABLE ${table} ADD COLUMN forma_pagamento VARCHAR(50) DEFAULT NULL`);
                console.log(`  -> Added forma_pagamento to ${table}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`  -> Column already exists in ${table}`);
                } else if (err.code === 'ER_NO_SUCH_TABLE') {
                    console.log(`  -> Table ${table} does not exist`);
                } else {
                    console.error(`  -> Error in ${table}:`, err.message);
                }
            }
        }
        console.log('Done!');
    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        if (connection) connection.end();
    }
}

addColumns();
