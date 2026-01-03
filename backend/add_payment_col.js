const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function addColumn() {
    let connection;
    try {
        console.log('Connecting to DB...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        console.log('Adding forma_pagamento column...');
        await connection.query("ALTER TABLE entradas ADD COLUMN forma_pagamento VARCHAR(50) DEFAULT NULL AFTER valor");
        console.log('Success!');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists.');
        } else {
            console.error(err);
        }
    } finally {
        if (connection) connection.end();
    }
}

addColumn();
