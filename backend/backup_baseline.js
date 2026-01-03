require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'database', 'backups');

async function backupDatabase() {
    console.log('=== Database Schema Backup ===');
    console.log(`Database: ${process.env.DB_NAME || 'NOT SET'}`);
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

        console.log('✅ Connected successfully!');

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
-- Baseline: v1.0.0-export-features

SET FOREIGN_KEY_CHECKS=0;

`;

        // Get all tables
        console.log('Fetching tables...');
        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);

        console.log(`Found ${tableNames.length} tables to backup`);
        console.log('');

        // Export each table
        for (const tableName of tableNames) {
            process.stdout.write(`  ${tableName.padEnd(30)} ... `);

            const [createResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createStatement = createResult[0]['Create Table'];

            sql += `-- ============================================\n`;
            sql += `-- Table: ${tableName}\n`;
            sql += `-- ============================================\n`;
            sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            sql += createStatement + ';\n\n';

            console.log('✓');
        }

        sql += 'SET FOREIGN_KEY_CHECKS=1;\n';

        // Close connection
        await connection.end();

        // Write files
        const filename = `schema_baseline_${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        await fs.writeFile(filepath, sql, 'utf8');

        const latestPath = path.join(BACKUP_DIR, 'schema_baseline_latest.sql');
        await fs.writeFile(latestPath, sql, 'utf8');

        console.log('');
        console.log('✅ Backup completed successfully!');
        console.log('');
        console.log(`📁 Timestamped: ${filepath}`);
        console.log(`📌 Latest:      ${latestPath}`);
        console.log(`📊 Size:        ${(sql.length / 1024).toFixed(2)} KB`);
        console.log(`📋 Tables:      ${tableNames.length}`);
        console.log('');
        console.log('💡 This backup can be used for rollback if needed');

    } catch (error) {
        console.error('');
        console.error('❌ Backup failed:');
        console.error(error.message);
        if (error.code) console.error(`Code: ${error.code}`);
        console.error('');
        process.exit(1);
    }
}

backupDatabase();
