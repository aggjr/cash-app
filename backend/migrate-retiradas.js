const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Adding data_prevista to retiradas table...');
        await connection.query(`
            ALTER TABLE retiradas
            ADD COLUMN data_prevista DATE NULL AFTER data_fato;
        `);
        console.log('Migration successful.');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists.');
        } else {
            console.error('Migration failed:', error);
        }
    } finally {
        await connection.end();
    }
}

migrate();
