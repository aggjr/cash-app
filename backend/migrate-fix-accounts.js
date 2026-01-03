const db = require('./config/database');

async function migrateFixAccounts() {
    let connection;
    try {
        connection = await db.getConnection();

        console.log('Running migration: Fix Accounts Nullable...');

        // 1. Modify RETIRADAS
        try {
            await connection.query('ALTER TABLE retiradas MODIFY account_id INT NULL');
            console.log('✅ retiradas table updated (account_id NULL)');
        } catch (e) {
            console.warn('⚠️ Error updating retiradas:', e.message);
        }

        // 2. Modify APORTES
        try {
            await connection.query('ALTER TABLE aportes MODIFY account_id INT NULL');
            console.log('✅ aportes table updated (account_id NULL)');
        } catch (e) {
            console.warn('⚠️ Error updating aportes:', e.message);
        }

        // 3. Modify SAIDAS
        try {
            await connection.query('ALTER TABLE saidas MODIFY account_id INT NULL');
            console.log('✅ saidas table updated (account_id NULL)');
        } catch (e) {
            console.warn('⚠️ Error updating saidas:', e.message);
        }

        // 4. Modify PRODUCAO_REVENDA
        try {
            await connection.query('ALTER TABLE producao_revenda MODIFY account_id INT NULL');
            console.log('✅ producao_revenda table updated (account_id NULL)');
        } catch (e) {
            console.warn('⚠️ Error updating producao_revenda:', e.message);
        }

        // 5. Modify ENTRADAS (New Fix)
        try {
            await connection.query('ALTER TABLE entradas MODIFY account_id INT NULL');
            console.log('✅ entradas table updated (account_id NULL)');
        } catch (e) {
            console.warn('⚠️ Error updating entradas:', e.message);
        }

        console.log('Migration Fix Accounts completed.');

        // Verification
        try {
            console.log('Verifying modification...');
            const [cols] = await connection.query(`
                SELECT COLUMN_NAME, IS_NULLABLE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'cash_db' AND TABLE_NAME = 'retiradas' AND COLUMN_NAME = 'account_id'
            `);
            if (cols.length > 0) {
                console.log(`Verification: account_id for retiradas is IS_NULLABLE=${cols[0].IS_NULLABLE}`);
            }
        } catch (e) {
            console.error('Verification failed:', e.message);
        }

    } catch (error) {
        console.error('Migration Fix Accounts failed:', error);
        // We do NOT exit process here, just log error, to allow server to start even if migration fails (e.g. connectivity issues)
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateFixAccounts;
