const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' }); // Adjust path to env if needed

async function migrate() {
    console.log('Starting migration: Add data_contato to leads_campanhas...');

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
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leads_campanhas' AND COLUMN_NAME = 'data_contato'
            `, [process.env.DB_NAME || 'cash_db']);

            if (columns.length === 0) {
                console.log('Column data_contato missing. Adding it...');
                await connection.query(`
                    ALTER TABLE leads_campanhas
                    ADD COLUMN data_contato DATETIME NULL AFTER status
                `);
                console.log('✅ Column data_contato added successfully.');
            } else {
                console.log('ℹ️ Column data_contato already exists.');
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
