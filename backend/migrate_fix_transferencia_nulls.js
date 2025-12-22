const db = require('./config/database');

async function fixTransferenciaNulls() {
    let connection;
    try {
        console.log('🔧 Fixing nullability for account columns in transferencias table...');

        connection = await db.getConnection();

        // Modify source_account_id to allow NULL
        await connection.query(`
            ALTER TABLE transferencias 
            MODIFY COLUMN source_account_id INT NULL
        `);

        // Modify destination_account_id to allow NULL
        await connection.query(`
            ALTER TABLE transferencias 
            MODIFY COLUMN destination_account_id INT NULL
        `);

        console.log('✅ Successfully modified account columns to allow NULL');

    } catch (error) {
        console.error('❌ Error modifying account columns:', error);
        // Don't throw if error is just about column not existing or something trivial, 
        // but "cannot be null" implies table exists.
    } finally {
        if (connection) connection.release();
    }
}

module.exports = fixTransferenciaNulls;
