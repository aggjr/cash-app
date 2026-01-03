const db = require('./config/database');

async function migrateVoicePremiumToDefault() {
    console.log('🔄 Starting migration: Set Premium Voice as Default for Existing Users');

    const connection = await db.getConnection();

    try {
        // Update all existing records with NULL or 0 to Premium (2)
        const [result] = await connection.query(`
            UPDATE system_settings 
            SET eva_voice_premium = 2 
            WHERE eva_voice_premium IS NULL OR eva_voice_premium = 0
        `);

        console.log(`✅ Updated ${result.affectedRows} project(s) to Premium voice (eva_voice_premium = 2)`);

        // Also set female as default if NULL
        const [result2] = await connection.query(`
            UPDATE system_settings 
            SET eva_voice_male = 0 
            WHERE eva_voice_male IS NULL
        `);

        console.log(`✅ Updated ${result2.affectedRows} project(s) to Female voice (eva_voice_male = 0)`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = migrateVoicePremiumToDefault;
