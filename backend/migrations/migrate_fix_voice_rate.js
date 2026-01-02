const db = require('../config/db');

const migrateFixVoiceRate = async () => {
    try {
        console.log('Running migration: Fix Voice Rate values...');

        // Reset voice rate to 50 (Normal) for any user with rate > 80 (Legacy High values) or NULL
        // This ensures everyone starts with the new "Normal" speed (1.0x) instead of very fast
        const query = `
            UPDATE users 
            SET eva_voice_rate = 50 
            WHERE eva_voice_rate > 80 OR eva_voice_rate IS NULL
        `;

        const [result] = await db.execute(query);
        console.log(`Migration Fix Voice Rate completed. Updated rows: ${result.affectedRows}`);
    } catch (error) {
        console.error('Error running migration Fix Voice Rate:', error);
    }
};

module.exports = migrateFixVoiceRate;
