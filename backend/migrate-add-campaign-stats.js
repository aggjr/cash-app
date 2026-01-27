require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // Add status_email column
        try {
            await connection.query(`
                ALTER TABLE leads_campanhas 
                ADD COLUMN status_email VARCHAR(50) DEFAULT 'pendente' AFTER status
            `);
            console.log('Added column: status_email');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column status_email already exists.');
            } else {
                throw e;
            }
        }

        // Add status_whatsapp column
        try {
            await connection.query(`
                ALTER TABLE leads_campanhas 
                ADD COLUMN status_whatsapp VARCHAR(50) DEFAULT 'pendente' AFTER status_email
            `);
            console.log('Added column: status_whatsapp');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column status_whatsapp already exists.');
            } else {
                throw e;
            }
        }

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
