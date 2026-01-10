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
        console.log('Checking for preferred_name column in users table...');

        // Check if column exists first
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferred_name'
        `, [process.env.DB_NAME]);

        if (columns.length > 0) {
            console.log('Column found. Dropping preferred_name...');
            await connection.execute(`
                ALTER TABLE users 
                DROP COLUMN preferred_name
            `);
            console.log('Column preferred_name dropped successfully.');
        } else {
            console.log('Column preferred_name does not exist. Nothing to do.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate(); // Auto-run if executed directly
module.exports = migrate;
