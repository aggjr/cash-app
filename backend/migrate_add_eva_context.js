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
        console.log('Adding eva_context column to projects...');
        await db.query(`
            ALTER TABLE projects 
            ADD COLUMN IF NOT EXISTS eva_context JSONB DEFAULT '{}'::jsonb
        `);

        // Add GIN index for efficient JSONB queries
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_projects_eva_context 
            ON projects USING GIN (eva_context)
        `);

        console.log('✅ projects.eva_context added');

        // Add eva_preferences to users table
        console.log('Adding eva_preferences column to users...');
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS eva_preferences JSONB DEFAULT '{}'::jsonb
        `);

        // Add GIN index for efficient JSONB queries
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_users_eva_preferences 
            ON users USING GIN (eva_preferences)
        `);

        console.log('✅ users.eva_preferences added');

        // Set default context for existing projects (example)
        console.log('Setting default context for existing projects...');
        await db.query(`
            UPDATE projects 
            SET eva_context = jsonb_build_object(
                'business_type', 'general',
                'tone', 'formal',
                'custom_instructions', ''
            )
            WHERE eva_context = '{}'::jsonb OR eva_context IS NULL
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
