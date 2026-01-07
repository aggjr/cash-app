require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugDB() {
    let connection;
    try {
        console.log('Connecting to DB...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });
        console.log('Success! Listing tables:');
        const [tables] = await connection.query('SHOW TABLES');
        console.log(JSON.stringify(tables, null, 2));
    } catch (err) {
        console.error('Connection failed:', err.message);
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}
debugDB();
