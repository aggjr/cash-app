const path = require('path');
// Forced path to mysql2 inside backend/node_modules
const mysqlPath = path.join(__dirname, 'node_modules', 'mysql2', 'promise');
console.log('Trying custom require:', mysqlPath);
let mysql;
try {
    mysql = require(mysqlPath);
} catch (e) {
    console.error('Failed to load local mysql2:', e.message);
    // Try global or peer?
    try {
        mysql = require('mysql2/promise');
    } catch (e2) {
        console.error('Failed generic require:', e2.message);
        process.exit(1);
    }
}

const config = {
    host: '127.0.0.1',
    user: 'root',
    password: 'Dani160779!',
    database: 'cash_db'
};

async function run() {
    let connection;
    try {
        console.log('🔌 Connecting...');
        connection = await mysql.createConnection(config);

        console.log('Checking columns...');
        const [cols] = await connection.execute("SHOW COLUMNS FROM users");
        const colNames = cols.map(c => c.Field);

        if (colNames.includes('preferred_name')) {
            console.log('Dropping preferred_name...');
            await connection.execute('ALTER TABLE users DROP COLUMN preferred_name');
        } else {
            console.log('preferred_name not found.');
        }

        if (colNames.includes('gender')) {
            console.log('Dropping gender...');
            await connection.execute('ALTER TABLE users DROP COLUMN gender');
        } else {
            console.log('gender not found.');
        }

        console.log('✅ Done.');
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        if (connection) await connection.end();
    }
}

run();
