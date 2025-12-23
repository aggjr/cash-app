#!/usr/bin/env node

/**
 * Database Schema Restore Script
 * 
 * Restores database schema from a backup file
 * 
 * Usage:
 *   node restore_schema.js <backup_file.sql>
 * 
 * Example:
 *   node restore_schema.js database/backups/schema_latest.sql
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    });
}

async function restoreSchema(sqlFile) {
    console.log('=== Database Schema Restore ===');
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`Backup file: ${sqlFile}`);
    console.log('');

    try {
        // Check if file exists
        await fs.access(sqlFile);

        // Read SQL file
        console.log('Reading backup file...');
        const sql = await fs.readFile(sqlFile, 'utf8');
        console.log(`File size: ${(sql.length / 1024).toFixed(2)} KB`);

        // Confirm before proceeding
        console.log('');
        console.log('⚠️  WARNING: This will DROP and RECREATE all tables!');
        console.log('⚠️  Make sure you have a backup of the current state!');
        console.log('');

        // Connect and execute
        console.log('Connecting to database...');
        const connection = await getConnection();

        console.log('Executing restore...');
        await connection.query(sql);

        console.log('Verifying restore...');
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`✅ Restored ${tables.length} tables`);

        await connection.end();

        console.log('');
        console.log('✅ Restore completed successfully!');

    } catch (error) {
        console.error('❌ Restore failed:', error.message);
        process.exit(1);
    }
}

// Main
if (require.main === module) {
    const sqlFile = process.argv[2];

    if (!sqlFile) {
        console.error('Usage: node restore_schema.js <backup_file.sql>');
        process.exit(1);
    }

    const fullPath = path.isAbsolute(sqlFile) ? sqlFile : path.join(process.cwd(), sqlFile);
    restoreSchema(fullPath);
}

module.exports = { restoreSchema };
