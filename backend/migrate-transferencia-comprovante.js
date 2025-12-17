require('dotenv').config({ path: './backend/.env' });
const db = require('./config/database');

async function migrate() {
    const connection = await db.getConnection();
    try {
        console.log('Starting migration: Add comprovante_url to transferencias...');

        // Check if column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'transferencias' 
            AND COLUMN_NAME = 'comprovante_url'
        `);

        if (columns.length === 0) {
            await connection.query(`
                ALTER TABLE transferencias 
                ADD COLUMN comprovante_url VARCHAR(255) NULL AFTER active
            `);
            console.log('Column comprovante_url added to transferencias.');
        } else {
            console.log('Column comprovante_url already exists.');
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

migrate();
