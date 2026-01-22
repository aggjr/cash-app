const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function migrate() {
    console.log('Starting migration: Add media_url to campanhas...');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'cash_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const connection = await pool.getConnection();
        try {
            // Check if column exists
            const [columns] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'campanhas' AND COLUMN_NAME = 'media_url'
            `, [process.env.DB_NAME || 'cash_db']);

            if (columns.length === 0) {
                console.log('Column media_url missing. Adding it...');
                await connection.query(`
                    ALTER TABLE campanhas
                    ADD COLUMN media_url TEXT NULL AFTER whatsapp_text
                `);
                console.log('✅ Column media_url added successfully.');
            } else {
                console.log('ℹ️ Column media_url already exists.');
            }

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
