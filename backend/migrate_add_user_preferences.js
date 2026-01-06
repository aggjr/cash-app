const db = require('./config/database');

async function migrate() {
    try {
        console.log('Starting migration: user_preferences table...');
        const connection = await db.getConnection();

        // Create user_preferences table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    preference_key VARCHAR(100) NOT NULL,
                    preference_value JSON NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_user_preference (user_id, preference_key),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_preference_key (preference_key)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ Created table: user_preferences');
        } catch (e) {
            if (e.code === 'ER_TABLE_EXISTS_ERROR') {
                console.log('→ Table user_preferences already exists');
            } else {
                throw e;
            }
        }

        connection.release();
        console.log('✅ Migration completed: user_preferences');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

module.exports = migrate;
