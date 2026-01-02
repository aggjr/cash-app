const db = require('./config/database');

/**
 * Migration: Add User Role Columns
 * Adds job_title and department to users table for role-based EVA context
 */

async function migrate() {
    console.log('🔄 Starting User Roles migration...');

    try {
        // Add job_title
        console.log('Adding job_title column to users...');
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS job_title VARCHAR(100) DEFAULT NULL
        `);

        // Add department
        console.log('Adding department column to users...');
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT NULL
        `);

        console.log('✅ User role columns added successfully');
        return true;

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    migrate()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('Migration error:', err);
            process.exit(1);
        });
}

module.exports = migrate;
