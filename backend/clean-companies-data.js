const db = require('./config/database');

async function cleanData() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await db.getConnection();
        await connection.beginTransaction();

        console.log('Disabling FK checks...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        console.log('Cleaning transaction tables...');
        try { await connection.query('DELETE FROM entradas'); } catch (e) { }
        try { await connection.query('DELETE FROM saidas'); } catch (e) { }
        try { await connection.query('DELETE FROM transacoes_financeiras'); } catch (e) { } // cover generic name if exists

        console.log('Cleaning accounts table...');
        await connection.query('DELETE FROM contas');

        console.log('Cleaning companies table...');
        await connection.query('DELETE FROM empresas');

        console.log('Enabling FK checks...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        await connection.commit();
        console.log('✅ Data cleaned successfully (Companies and Accounts cleared).');

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('❌ Error cleaning data:', error);
    } finally {
        if (connection) {
            connection.release();
        }
        // Close the pool to allow script to exit
        // db.end() is not exposed directly in some pool configs, but process.exit will handle it
        process.exit();
    }
}

cleanData();
