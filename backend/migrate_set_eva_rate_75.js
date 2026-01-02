const db = require('./config/database');

async function migrateSetEvaRate75() {
    console.log('🔧 Migration: Setting EVA voice rate to 75 (Fast) for all users...');
    let connection;
    try {
        connection = await db.getConnection();

        // 1. Update all existing users to 75
        // User request: "definir a velocidade padrao da EVA em 75 para todos os usuários"
        // This implies overriding current settings.
        const [result] = await connection.query(`
            UPDATE users SET eva_voice_rate = 75
        `);
        console.log(`✅ Updated ${result.affectedRows} users to voice rate 75.`);

        // 2. Change column default to 75
        await connection.query(`
            ALTER TABLE users ALTER COLUMN eva_voice_rate SET DEFAULT 75
        `);
        console.log('✅ Updated default value for eva_voice_rate to 75.');

        // 3. Optional: Check system_settings if it exists (legacy)
        try {
            const [sysCols] = await connection.query("SHOW COLUMNS FROM system_settings LIKE 'eva_voice_rate'");
            if (sysCols.length > 0) {
                await connection.query("UPDATE system_settings SET eva_voice_rate = 75");
                await connection.query("ALTER TABLE system_settings ALTER COLUMN eva_voice_rate SET DEFAULT 75");
                console.log('✅ Updated system_settings legacy table as well.');
            }
        } catch (ignored) {
            // Ignore if system_settings behaves unexpectedly
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateSetEvaRate75;

// Run if executed directly
if (require.main === module) {
    migrateSetEvaRate75()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
