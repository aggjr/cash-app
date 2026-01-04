/**
 * Migration: Add IVA screen familiarity tracking
 * Tracks how many times user visited each screen
 * Used to make IVA more/less verbose based on familiarity
 */

const mysql = require('mysql2/promise');

async function migrateAddScreenFamiliarity() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('[Migration] Starting: Add iva_screen_familiarity to users table');

        // Check if column already exists
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM users LIKE 'iva_screen_familiarity'
        `);

        if (columns.length > 0) {
            console.log('[Migration] Column iva_screen_familiarity already exists. Skipping.');
            return;
        }

        // Add column
        await connection.query(`
            ALTER TABLE users 
            ADD COLUMN iva_screen_familiarity JSON DEFAULT NULL
            COMMENT 'Tracks visit count per screen for adaptive IVA verbosity'
        `);

        console.log('[Migration] ✅ Successfully added iva_screen_familiarity column');

        // Initialize existing users with empty object
        await connection.query(`
            UPDATE users 
            SET iva_screen_familiarity = JSON_OBJECT()
            WHERE iva_screen_familiarity IS NULL
        `);

        console.log('[Migration] ✅ Initialized existing users');

    } catch (error) {
        console.error('[Migration] ❌ Error:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

module.exports = migrateAddScreenFamiliarity;

