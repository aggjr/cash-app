const db = require('./config/database');

/**
 * Migration: Add EVA context columns
 * Adds JSONB columns for hierarchical context:
 * - projects.eva_context: Project-level business context
 * - users.eva_preferences: User-level personal preferences
 */

async function migrate() {
    console.log('🔄 Starting EVA context migration...');

    try {
        // Add eva_context to projects table
        console.log('Checking projects table for eva_context column...');
        const [projColumns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'eva_context'
        `, [process.env.DB_NAME]);

        if (projColumns.length === 0) {
            console.log('Adding eva_context column to projects...');
            await db.query(`ALTER TABLE projects ADD COLUMN eva_context JSON`);
            console.log('✅ projects.eva_context added');
        } else {
            console.log('ℹ️ projects.eva_context already exists');
        }

        // Add eva_preferences to users table
        console.log('Checking users table for eva_preferences column...');
        const [userColumns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'eva_preferences'
        `, [process.env.DB_NAME]);

        if (userColumns.length === 0) {
            console.log('Adding eva_preferences column to users...');
            await db.query(`ALTER TABLE users ADD COLUMN eva_preferences JSON`);
            console.log('✅ users.eva_preferences added');
        } else {
            console.log('ℹ️ users.eva_preferences already exists');
        }

        // Set default context for existing projects (MySQL compatible JSON update)
        // Note: JSON_OBJECT is MySQL syntax, jsonb_build_object is Postgres
        console.log('Setting default context for existing projects...');

        // We handle null/empty check safely
        await db.query(`
            UPDATE projects 
            SET eva_context = JSON_OBJECT(
                'business_type', 'general',
                'tone', 'formal',
                'custom_instructions', ''
            )
            WHERE eva_context IS NULL 
        `);

        console.log('✅ Default context set for existing projects');

        console.log('✅ EVA context migration completed successfully!');
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
