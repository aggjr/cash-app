const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function migrate() {
    console.log('Starting migration: Fix campanhas status column...');

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
            // Check current status column definition
            const [columns] = await connection.query(`
                SELECT COLUMN_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'campanhas' AND COLUMN_NAME = 'status'
            `, [process.env.DB_NAME || 'cash_db']);

            if (columns.length > 0) {
                console.log('Current status column type:', columns[0].COLUMN_TYPE);

                // Check if it's an ENUM
                if (columns[0].COLUMN_TYPE.includes('enum')) {
                    console.log('Status is ENUM. Modifying to include missing values...');

                    // Modify ENUM to include all necessary values
                    await connection.query(`
                        ALTER TABLE campanhas
                        MODIFY COLUMN status ENUM(
                            'planejamento',
                            'ativa',
                            'pausada',
                            'concluida',
                            'cancelada',
                            'enviando',
                            'envio_finalizado',
                            'erro'
                        ) DEFAULT 'planejamento'
                    `);
                    console.log('✅ Status column updated successfully with new values.');
                } else {
                    console.log('Status is not ENUM. Converting to VARCHAR for flexibility...');

                    // Convert to VARCHAR for more flexibility
                    await connection.query(`
                        ALTER TABLE campanhas
                        MODIFY COLUMN status VARCHAR(50) DEFAULT 'planejamento'
                    `);
                    console.log('✅ Status column converted to VARCHAR(50).');
                }
            } else {
                console.log('❌ Status column not found!');
            }

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

migrate();
