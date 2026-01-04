const mysql = require('mysql2/promise');

async function migrateVoiceSettingsToBoolean() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'cash_flow'
    });

    try {
        console.log('Starting migration: convert voice settings to boolean');

        // Check if old columns exist
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'system_settings' 
            AND COLUMN_NAME IN ('iva_voice_type', 'iva_voice_gender', 'iva_voice_premium', 'iva_voice_male')
        `);

        const existingColumns = columns.reduce((acc, row) => {
            acc[row.COLUMN_NAME] = row.DATA_TYPE;
            return acc;
        }, {});

        console.log('Existing columns:', existingColumns);

        // If old VARCHAR columns exist, migrate them
        if (existingColumns.iva_voice_type || existingColumns.iva_voice_gender) {
            console.log('Migrating from VARCHAR to BOOLEAN...');

            // Add new boolean columns
            if (!existingColumns.iva_voice_premium) {
                await connection.query(`
                    ALTER TABLE system_settings 
                    ADD COLUMN iva_voice_premium TINYINT(1) DEFAULT 0
                `);
                console.log('✓ Added column: iva_voice_premium (BOOLEAN)');
            }

            if (!existingColumns.iva_voice_male) {
                await connection.query(`
                    ALTER TABLE system_settings 
                    ADD COLUMN iva_voice_male TINYINT(1) DEFAULT 0
                `);
                console.log('✓ Added column: iva_voice_male (BOOLEAN)');
            }

            // Convert existing data
            if (existingColumns.iva_voice_type) {
                await connection.query(`
                    UPDATE system_settings 
                    SET iva_voice_premium = CASE 
                        WHEN iva_voice_type = 'premium' THEN 1 
                        ELSE 0 
                    END
                `);
                console.log('✓ Converted iva_voice_type to iva_voice_premium');

                // Drop old column
                await connection.query('ALTER TABLE system_settings DROP COLUMN iva_voice_type');
                console.log('✓ Dropped old column: iva_voice_type');
            }

            if (existingColumns.iva_voice_gender) {
                await connection.query(`
                    UPDATE system_settings 
                    SET iva_voice_male = CASE 
                        WHEN iva_voice_gender = 'male' THEN 1 
                        ELSE 0 
                    END
                `);
                console.log('✓ Converted iva_voice_gender to iva_voice_male');

                // Drop old column
                await connection.query('ALTER TABLE system_settings DROP COLUMN iva_voice_gender');
                console.log('✓ Dropped old column: iva_voice_gender');
            }
        } else {
            // Fresh install - just create boolean columns
            if (!existingColumns.iva_voice_premium) {
                await connection.query(`
                    ALTER TABLE system_settings 
                    ADD COLUMN iva_voice_premium TINYINT(1) DEFAULT 0
                `);
                console.log('✓ Added column: iva_voice_premium (BOOLEAN)');
            }

            if (!existingColumns.iva_voice_male) {
                await connection.query(`
                    ALTER TABLE system_settings 
                    ADD COLUMN iva_voice_male TINYINT(1) DEFAULT 0
                `);
                console.log('✓ Added column: iva_voice_male (BOOLEAN)');
            }
        }

        console.log('✓ Migration completed successfully');
    } catch (error) {
        console.error('✗ Migration failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

module.exports = migrateVoiceSettingsToBoolean;

