const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function backupDatabase() {
    console.log('📦 Starting Database Backup...');
    let connection;
    try {
        connection = await db.getConnection();

        // 1. Get all tables
        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);

        console.log(`Found ${tableNames.length} tables:`, tableNames.join(', '));

        const backupData = {};

        // 2. Fetch data from each table
        for (const table of tableNames) {
            console.log(`Reading table: ${table}...`);
            const [rows] = await connection.query(`SELECT * FROM ${table}`);
            backupData[table] = rows;
        }

        // 3. Ensure backup directory exists
        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // 4. Write to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_v0.1.0_${timestamp}.json`;
        const filepath = path.join(backupDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

        console.log(`✅ Backup successfully created at: ${filepath}`);
        console.log(`Total tables backed up: ${Object.keys(backupData).length}`);

    } catch (error) {
        console.error('❌ Backup Failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

backupDatabase();
