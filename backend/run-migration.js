const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../database/add-transfer-column.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by DELIMITER if needed, but for this specific file,
        // since we are using mysql2 driver which handles multiple statements if enabled (which might not be),
        // we might need to be careful.
        // However, the file uses DELIMITER syntax which is for CLI.
        // Let's strip the DELIMITER parts and just run the procedure creation and call.

        // Actually, for simplicity in Node, we can just run the ALTER TABLE directly inside a try-catch ignoring "Duplicate column" error.
        // The Procedure approach is good for CLI but complex to parse here.

        console.log('Running migration...');

        try {
            await db.query(`
                ALTER TABLE retiradas 
                ADD COLUMN destination_account_id INT NULL AFTER account_id,
                ADD CONSTRAINT fk_retiradas_destination FOREIGN KEY (destination_account_id) REFERENCES contas(id);
            `);
            console.log('Migration successful: Column added.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Migration skipped: Column already exists.');
            } else {
                throw e;
            }
        }

    } catch (e) {
        console.error('Migration failed:', e);
    }
    process.exit();
}

runMigration();
