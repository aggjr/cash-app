const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Adding preferred_name column to users table...');

        // Check if column exists first
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferred_name'
        `, [process.env.DB_NAME]);

        if (columns.length === 0) {
            await connection.execute(`
                ALTER TABLE users 
                ADD COLUMN preferred_name VARCHAR(100) DEFAULT NULL AFTER name
            `);
            console.log('Column preferred_name added successfully.');
        } else {
            console.log('Column preferred_name already exists.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

module.exports = migrate;
