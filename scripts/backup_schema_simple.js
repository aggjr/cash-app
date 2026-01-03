const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const mysql = require('mysql2/promise');
const fs = require('fs').promises;

const BACKUP_DIR = path.join(__dirname, '..', 'database', 'backups');

async function backupDatabase() {
    console.log('=== Database Schema Backup ===');
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log('');

    try {
        // Ensure backup directory exists
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // Connect to database
        console.log('Connecting to database...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        console.log('Connected successfully!');

        // Generate timestamp
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/T/, '_')
            .replace(/\..+/, '')
            .replace(/:/g, '-');

        // Start SQL
        let sql = `-- Database Schema Backup
-- Generated: ${now.toISOString()}
-- Database: ${process.env.DB_NAME}

SET FOREIGN_KEY_CHECKS=0;

`;

        // Get all tables
        console.log('Fetching tables...');
        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);

        console.log(`Found ${tableNames.length} tables`);
        console.log('');

        // Export each table
        for (const tableName of tableNames) {
            console.log(`Exporting: ${tableName}`);

            const [createResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createStatement = createResult[0]['Create Table'];

            sql += `-- Table: ${tableName}\n`;
            sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            sql += createStatement + ';\n\n';
        }

        sql += 'SET FOREIGN_KEY_CHECKS=1;\n';

        // Close connection
        await connection.end();

        // Write files
        const filename = `schema_backup_${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        await fs.writeFile(filepath, sql, 'utf8');

        const latestPath = path.join(BACKUP_DIR, 'schema_latest.sql');
        await fs.writeFile(latestPath, sql, 'utf8');

        console.log('');
        console.log('✅ Backup completed successfully!');
        console.log(`📁 File: ${filepath}`);
        console.log(`📊 Size: ${(sql.length / 1024).toFixed(2)} KB`);
        console.log(`📌 Latest: ${latestPath}`);

    } catch (error) {
        console.error('❌ Backup failed:');
        console.error(error);
        process.exit(1);
    }
}

backupDatabase();
