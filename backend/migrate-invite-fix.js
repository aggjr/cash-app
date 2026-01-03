const db = require('./config/database');

async function migrate() {
    try {
        console.log('Setting default for password_reset_required...');
        // Check if column exists first
        const [cols] = await db.query("SHOW COLUMNS FROM project_users LIKE 'password_reset_required'");
        if (cols.length === 0) {
            await db.query("ALTER TABLE project_users ADD COLUMN password_reset_required TINYINT(1) DEFAULT 1");
            console.log('Added password_reset_required with default 1');
        } else {
            await db.query("ALTER TABLE project_users MODIFY COLUMN password_reset_required TINYINT(1) DEFAULT 1");
            console.log('Updated password_reset_required default to 1');
        }
    } catch (e) {
        console.error('Migration failed:', e);
    }
    process.exit();
}

migrate();
