const fs = require('fs');
const path = require('path');
const db = require('./config/database');

const backupDir = path.join(__dirname, 'database', 'backups', 'v1.0-stable-filters');

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

async function backup() {
    try {
        console.log(`Starting backup to ${backupDir}...`);

        // Get all tables
        const [tables] = await db.query('SHOW TABLES');
        const tableKey = Object.keys(tables[0])[0]; // Usually 'Tables_in_dbname'

        for (const row of tables) {
            const tableName = row[tableKey];
            console.log(`Backing up ${tableName}...`);

            const [rows] = await db.query(`SELECT * FROM ${tableName}`);

            fs.writeFileSync(
                path.join(backupDir, `${tableName}.json`),
                JSON.stringify(rows, null, 2)
            );
        }

        console.log('Backup completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Backup failed:', error);
        process.exit(1);
    }
}

backup();
