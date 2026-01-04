const db = require('./config/database');

const migrateFixVoiceRate = async () => {
    let connection;
    try {
        console.log('Running migration: Fix Voice Rate values...');
        connection = await db.getConnection();

        // 1. Check if column exists in users table
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM users LIKE 'iva_voice_rate'
        `);

        if (columns.length === 0) {
            console.log('Column iva_voice_rate missing in users table. Creating...');
            await connection.query(`
                ALTER TABLE users
                ADD COLUMN iva_voice_rate INT DEFAULT 50
                COMMENT 'IVA voice speed: 0-100, 50=Normal'
            `);
            console.log('Column iva_voice_rate created successfully.');
        } else {
            console.log('Column iva_voice_rate already exists in users table.');
        }

        // 2. Reset voice rate to 50 (Normal) for any user with rate > 80 (Legacy High values) or NULL
        // Ensuring user has a valid sane default
        const query = `
            UPDATE users 
            SET iva_voice_rate = 50 
            WHERE iva_voice_rate > 80 OR iva_voice_rate IS NULL
        `;

        const [result] = await connection.query(query);
        console.log(`Migration Fix Voice Rate completed. Updated rows: ${result.affectedRows}`);

    } catch (error) {
        console.error('Error running migration Fix Voice Rate:', error);
    } finally {
        if (connection) connection.release();
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

