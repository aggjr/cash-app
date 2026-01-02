const db = require('./config/database');

const migrateFixVoiceRate = async () => {
    try {
        console.log('Running migration: Fix Voice Rate values...');

        const connection = await db.getConnection();

        try {
            // Reset voice rate to 50 (Normal) for any user with rate > 80 (Legacy High values) or NULL
            const query = `
                UPDATE users 
                SET eva_voice_rate = 50 
                WHERE eva_voice_rate > 80 OR eva_voice_rate IS NULL
            `;

            const [result] = await connection.query(query);
            console.log(`Migration Fix Voice Rate completed. Updated rows: ${result.affectedRows}`);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error running migration Fix Voice Rate:', error);
    }
};

module.exports = migrateFixVoiceRate;

// Run if executed directly
if (require.main === module) {
    migrateFixVoiceRate()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
