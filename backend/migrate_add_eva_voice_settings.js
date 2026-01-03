const mysql = require('mysql2/promise');

async function migrateAddEvaVoiceSettings() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'cash_flow'
    });

    try {
        console.log('Starting migration: add_eva_voice_settings');

        // Check if columns already exist
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'system_settings' 
            AND COLUMN_NAME IN ('eva_voice_type', 'eva_voice_gender')
        `);

        const existingColumns = columns.map(row => row.COLUMN_NAME);

        // Add eva_voice_type if not exists
        if (!existingColumns.includes('eva_voice_type')) {
            await connection.query(`
                ALTER TABLE system_settings 
                ADD COLUMN eva_voice_type VARCHAR(20) DEFAULT 'free'
            `);
            console.log('✓ Added column: eva_voice_type');
        } else {
            console.log('⊘ Column eva_voice_type already exists');
        }

        // Add eva_voice_gender if not exists
        if (!existingColumns.includes('eva_voice_gender')) {
            await connection.query(`
                ALTER TABLE system_settings 
                ADD COLUMN eva_voice_gender VARCHAR(10) DEFAULT 'female'
            `);
            console.log('✓ Added column: eva_voice_gender');
        } else {
            console.log('⊘ Column eva_voice_gender already exists');
        }

        console.log('✓ Migration completed successfully');
    } catch (error) {
        console.error('✗ Migration failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

module.exports = migrateAddEvaVoiceSettings;
