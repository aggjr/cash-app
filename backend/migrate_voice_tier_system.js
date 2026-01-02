const db = require('./config/database');

async function migrateVoiceTierSystem() {
    console.log('🔄 Starting migration: Voice Tier System (0/1/2)');

    const connection = await db.getConnection();

    try {
        // Check current column type
        const [columns] = await connection.query(`
            SELECT COLUMN_TYPE, COLUMN_COMMENT 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'system_settings' 
            AND COLUMN_NAME = 'eva_voice_premium'
        `);

        if (columns.length === 0) {
            console.log('⚠️ Column eva_voice_premium does not exist. Skipping migration.');
            return;
        }

        const currentType = columns[0].COLUMN_TYPE;
        console.log('Current column type:', currentType);

        // Check if already migrated
        if (currentType.includes('tinyint') && columns[0].COLUMN_COMMENT?.includes('0=Free')) {
            console.log('✅ Migration already applied. Column supports 3 tiers.');
            return;
        }

        // Modify column to support 0/1/2
        await connection.query(`
            ALTER TABLE system_settings 
            MODIFY COLUMN eva_voice_premium TINYINT(1) DEFAULT 0 
            COMMENT '0=Free (browser), 1=Standard (Google), 2=Premium (Neural2)'
        `);

        console.log('✅ Column eva_voice_premium updated to support 3 tiers (0/1/2)');

        // Log current values
        const [settings] = await connection.query('SELECT eva_voice_premium FROM system_settings');
        console.log('Current values:', settings);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = migrateVoiceTierSystem;
