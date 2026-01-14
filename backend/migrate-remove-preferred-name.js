const db = require('./config/database');

async function dropPreferredNameColumn() {
    try {
        console.log('🔄 Checking for preferred_name column in users table...');

        // Check if column exists
        const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'preferred_name'");

        if (columns.length === 0) {
            console.log('✅ Column preferred_name does not exist. No action needed.');
            process.exit(0);
        }

        console.log('⚠️ Column found. Dropping preferred_name...');

        // Alter table to drop column
        await db.query('ALTER TABLE users DROP COLUMN preferred_name');

        console.log('✅ Successfully removed preferred_name from users table.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error dropping column:', error);
        process.exit(1);
    }
}

dropPreferredNameColumn();
