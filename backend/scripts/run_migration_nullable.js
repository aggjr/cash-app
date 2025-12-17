const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'migration_nullable_account.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon to run multiple statements
        const statements = sql.split(';').filter(stmt => stmt.trim());

        console.log(`Found ${statements.length} statements to execute.`);

        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.trim().substring(0, 50) + '...');
                await db.query(statement);
                console.log('Success.');
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
