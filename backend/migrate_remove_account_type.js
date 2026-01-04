const db = require('./config/database');

async function migrateRemoveAccountType() {
    let connection;
    try {
        connection = await db.pool.getConnection();

        // Check if column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'contas' 
            AND COLUMN_NAME = 'account_type'
        `);

        if (columns.length > 0) {
            console.log('🔄 Dropping account_type column from contas table...');
            await connection.query('ALTER TABLE contas DROP COLUMN account_type');
            console.log('✅ account_type column dropped successfully.');
        } else {
            console.log('✅ account_type column does not exist, skipping drop.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateRemoveAccountType;
