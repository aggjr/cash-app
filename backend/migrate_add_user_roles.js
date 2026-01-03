const db = require('./config/database');

/**
 * Migration: Add User Role Columns
 * Adds job_title and department to users table for role-based EVA context
 */

async function migrate() {
    console.log('🔄 Starting User Roles migration...');

    try {
        // Add job_title
        console.log('Checking users table for job_title column...');
        const [jobTitleCol] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'job_title'
        `, [process.env.DB_NAME]);

        if (jobTitleCol.length === 0) {
            console.log('Adding job_title column to users...');
            await db.query(`ALTER TABLE users ADD COLUMN job_title VARCHAR(100) DEFAULT NULL`);
            console.log('✅ job_title added');
        } else {
            console.log('ℹ️ job_title already exists');
        }

        // Add department
        console.log('Checking users table for department column...');
        const [deptCol] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'department'
        `, [process.env.DB_NAME]);

        if (deptCol.length === 0) {
            console.log('Adding department column to users...');
            await db.query(`ALTER TABLE users ADD COLUMN department VARCHAR(100) DEFAULT NULL`);
            console.log('✅ department added');
        } else {
            console.log('ℹ️ department already exists');
        }

        console.log('✅ User role columns migration completed successfully');
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
