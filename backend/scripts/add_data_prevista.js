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
        console.log('Starting migration...');
        connection = await pool.getConnection();

        // Check if column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'aportes' AND COLUMN_NAME = 'data_prevista'
        `, [process.env.DB_NAME || 'cash_db']);

        if (columns.length > 0) {
            console.log('Column data_prevista already exists in aportes table.');
        } else {
            console.log('Adding data_prevista to aportes table...');
            await connection.query(`
                ALTER TABLE aportes
                ADD COLUMN data_prevista DATE NULL AFTER data_fato;
            `);
            console.log('Column added successfully.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

migrate();
