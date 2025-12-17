require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'cash_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function migrate() {
    let connection;
    try {
        console.log('Starting migration for data_prevista_atraso...');
        connection = await pool.getConnection();

        const tables = [
            { name: 'entradas', after: 'data_prevista_recebimento' },
            { name: 'saidas', after: 'data_prevista_pagamento' },
            { name: 'producao_revenda', after: 'data_prevista_pagamento' }
        ];

        for (const table of tables) {
            // Check if column exists
            const [columns] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'data_prevista_atraso'
            `, [process.env.DB_NAME || 'cash_db', table.name]);

            if (columns.length > 0) {
                console.log(`Column data_prevista_atraso already exists in ${table.name}.`);
            } else {
                console.log(`Adding data_prevista_atraso to ${table.name}...`);
                await connection.query(`
                    ALTER TABLE ${table.name}
                    ADD COLUMN data_prevista_atraso DATE NULL AFTER ${table.after};
                `);
                console.log(`Column added to ${table.name} successfully.`);
            }
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

migrate();
