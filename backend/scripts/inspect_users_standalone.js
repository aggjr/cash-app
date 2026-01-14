const mysql = require('mysql2/promise');

// Hardcoded credentials based on previous .env dump
const dbConfig = {
    host: '127.0.0.1',
    user: 'root',
    password: 'Dani160779!', // Careful exposing this, but it's local dev
    database: 'cash_db'
};

(async () => {
    try {
        console.log('🔌 Connecting to MySQL...');
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected.');

        // 1. Check Columns
        console.log('\n🔍 Checking user table columns...');
        const [columns] = await connection.execute('SHOW COLUMNS FROM users');
        const columnNames = columns.map(c => c.Field);
        console.log('Users columns:', columnNames);

        // 2. Check for Guto
        console.log('\n🕵️ Searching for "Guto"...');
        const [rows] = await connection.execute('SELECT id, name, email FROM users WHERE name LIKE "%Guto%"');
        if (rows.length > 0) {
            console.log('⚠️ Found user with "Guto":', rows);
        } else {
            console.log('✅ No user found with name "Guto".');
        }

        // 3. Check for job_title or department if columns exist
        if (columnNames.includes('job_title')) {
            const [jobs] = await connection.execute('SELECT id, job_title FROM users WHERE job_title IS NOT NULL');
            console.log('Job Titles:', jobs);
        }

        // 4. Check for formatted data in IVA related columns
        if (columnNames.includes('preferred_name')) {
            const [prefs] = await connection.execute('SELECT id, preferred_name FROM users WHERE preferred_name IS NOT NULL');
            console.log('Preferred Names:', prefs);
        }

        await connection.end();
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
})();
