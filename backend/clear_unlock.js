const db = require('./config/database');

async function clearUnlock() {
    const connection = await db.getConnection();
    try {
        console.log('Clearing all unlock_expires_at...');

        const [result] = await connection.query(
            'UPDATE system_settings SET unlock_expires_at = NULL'
        );

        console.log(`✓ Cleared ${result.affectedRows} rows`);
        console.log('All projects are now in LOCK mode');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        connection.release();
        process.exit(0);
    }
}

clearUnlock();
