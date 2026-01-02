const db = require('./config/database');

async function migrateAddGenderColumn() {
    let connection;
    try {
        connection = await db.getConnection();

        // Check if column already exists
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM users LIKE 'gender'
        `);

        if (columns.length > 0) {
            console.log('✓ Column "gender" already exists in users table');
            return;
        }

        // Add gender column
        await connection.query(`
            ALTER TABLE users 
            ADD COLUMN gender CHAR(1) DEFAULT NULL COMMENT 'M=Masculino, F=Feminino'
            AFTER preferred_name
        `);

        console.log('✓ Migration: Added "gender" column to users table');

    } catch (error) {
        console.error('✗ Migration error (add gender column):', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateAddGenderColumn;
