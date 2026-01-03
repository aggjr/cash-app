#!/usr/bin/env node

/**
 * Database Schema Backup Script
 * 
 * Creates a complete backup of the database schema including:
 * - Table structures
 * - Indexes
 * - Foreign keys
 * - Initial data (optional)
 * 
 * Usage:
 *   node backup_schema.js [--with-data]
 * 
 * Output:
 *   database/backups/schema_backup_YYYY-MM-DD_HH-MM-SS.sql
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const mysql = require('mysql2/promise');
const fs = require('fs').promises;

const BACKUP_DIR = path.join(__dirname, '..', 'database', 'backups');

// Ensure backup directory exists
async function ensureBackupDir() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (err) {
        console.error('Error creating backup directory:', err);
        throw err;
    }
}

// Get database connection
async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });
}

// Generate timestamp for filename
function getTimestamp() {
    const now = new Date();
    return now.toISOString()
        .replace(/T/, '_')
        .replace(/\..+/, '')
        .replace(/:/g, '-');
}

// Export database schema
async function exportSchema(connection, withData = false) {
    let sql = `-- Database Schema Backup
-- Generated: ${new Date().toISOString()}
-- Database: ${process.env.DB_NAME}
-- 
-- Use this file to restore the database schema

SET FOREIGN_KEY_CHECKS=0;

`;

    // Get all tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);

    console.log(`Found ${tableNames.length} tables to backup...`);

    for (const tableName of tableNames) {
        console.log(`  Exporting: ${tableName}`);

        // Get CREATE TABLE statement
        const [createResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
        const createStatement = createResult[0]['Create Table'];

        sql += `-- Table: ${tableName}\n`;
        sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        sql += createStatement + ';\n\n';

        // Optionally export data
        if (withData) {
            const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);

            if (rows.length > 0) {
                sql += `-- Data for table: ${tableName}\n`;

                for (const row of rows) {
                    const columns = Object.keys(row).map(col => `\`${col}\``).join(', ');
                    const values = Object.values(row).map(val => {
                        if (val === null) return 'NULL';
                        if (typeof val === 'number') return val;
                        if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                        return `'${String(val).replace(/'/g, "''")}'`;
                    }).join(', ');

                    sql += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});\n`;
                }
                sql += '\n';
            }
        }
    }

    sql += 'SET FOREIGN_KEY_CHECKS=1;\n';

    return sql;
}

// Main function
async function main() {
    const withData = process.argv.includes('--with-data');

    console.log('=== Database Schema Backup ===');
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`Include data: ${withData ? 'YES' : 'NO'}`);
    console.log('');

    try {
        // Ensure backup directory exists
        await ensureBackupDir();

        // Connect to database
        console.log('Connecting to database...');
        const connection = await getConnection();

        // Export schema
        console.log('Exporting schema...');
        const sql = await exportSchema(connection, withData);

        // Close connection
        await connection.end();

        // Write to file
        const timestamp = getTimestamp();
        const filename = `schema_backup_${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        await fs.writeFile(filepath, sql, 'utf8');

        console.log('');
        console.log('✅ Backup completed successfully!');
        console.log(`📁 File: ${filepath}`);
        console.log(`📊 Size: ${(sql.length / 1024).toFixed(2)} KB`);

        // Also save as "latest" for easy access
        const latestPath = path.join(BACKUP_DIR, 'schema_latest.sql');
        await fs.writeFile(latestPath, sql, 'utf8');
        console.log(`📌 Latest backup: ${latestPath}`);

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { exportSchema, getConnection };
