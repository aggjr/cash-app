const db = require('./config/database');
require('dotenv').config();

async function updateTimeout() {
    console.log('Updating EVA timeout to 2 seconds...');
    const connection = await db.getConnection();
    try {
        await connection.query('UPDATE system_settings SET eva_timeout = 2');
        console.log('✅ EVA timeout updated to 2s successfully.');
    } catch (error) {
        console.error('❌ Error updating timeout:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

updateTimeout();
