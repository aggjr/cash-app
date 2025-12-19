const mysql = require('mysql2/promise');

async function quickTest() {
    console.log('Testing with minimal config...');

    try {
        const connection = await mysql.createConnection({
            host: '127.0.0.1',
            port: 3306,
            user: 'root',
            password: process.env.DB_PASSWORD || '',
            database: 'cash_db'
        });

        console.log('✅ Connected!');
        const [rows] = await connection.query('SELECT 1 as test');
        console.log('✅ Query worked:', rows);
        await connection.end();
        console.log('✅ All good!');
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Code:', error.code);
    }
}

require('dotenv').config();
quickTest();
