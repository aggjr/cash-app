const db = require('./config/database');

async function migrate() {
    try {
        console.log('Adding missing columns to project_users table...');

        // Add status
        try {
            await db.query("ALTER TABLE project_users ADD COLUMN status VARCHAR(20) DEFAULT 'active'");
            console.log('Added status column');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding status:', e);
            else console.log('status column already exists');
        }

        // Add invited_at
        try {
            await db.query("ALTER TABLE project_users ADD COLUMN invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            console.log('Added invited_at column');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding invited_at:', e);
            else console.log('invited_at column already exists');
        }

        // Add joined_at
        try {
            await db.query("ALTER TABLE project_users ADD COLUMN joined_at TIMESTAMP NULL");
            console.log('Added joined_at column');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding joined_at:', e);
            else console.log('joined_at column already exists');
        }

        // Ensure invited_by exists (it appeared in inspection but maybe missed?)
        try {
            await db.query("ALTER TABLE project_users ADD COLUMN invited_by INT NULL");
            console.log('Added invited_by column');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding invited_by:', e);
            else console.log('invited_by column already exists');
        }

        console.log('Migration completed.');
    } catch (e) {
        console.error('Migration failed:', e);
    }
    process.exit();
}

migrate();
