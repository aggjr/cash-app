const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../database/migration_transfer_nullable.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const statements = sql.split(';').filter(s => s.trim());

        console.log('Running migration...');
        for (const statement of statements) {
            if (statement.trim()) {
                await pool.query(statement);
                console.log('Executed:', statement.trim());
            }
        }
        console.log('Migration successful.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
