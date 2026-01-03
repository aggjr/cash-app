const db = require('./config/database');
require('dotenv').config();

async function migrateAddEvaVoiceRate() {
    console.log('🔧 Migration: Adding eva_voice_rate column to system_settings...');
    const connection = await db.getConnection();
    try {
        // Check if column already exists
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM system_settings LIKE 'eva_voice_rate'
        `);

        if (columns.length > 0) {
            console.log('✓ Column eva_voice_rate already exists');
            return;
        }

        // Add the column
        await connection.query(`
            ALTER TABLE system_settings
            ADD COLUMN eva_voice_rate INT DEFAULT 0
            COMMENT 'EVA voice speed adjustment: -100 to +100, 0 = 1.30x base rate'
        `);

        console.log('✅ Column eva_voice_rate added successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = migrateAddEvaVoiceRate;

// Run if executed directly
if (require.main === module) {
    migrateAddEvaVoiceRate()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
