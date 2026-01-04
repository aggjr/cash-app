const db = require('./config/database');

/**
 * Migration: Add IVA context columns
 * Adds JSONB columns for hierarchical context:
 * - projects.iva_context: Project-level business context
 * - users.iva_preferences: User-level personal preferences
 */

async function migrate() {
    console.log('🔄 Starting IVA context migration...');

    try {
        // Add iva_context to projects table
        console.log('Checking projects table for iva_context column...');
        const [projColumns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'iva_context'
        `, [process.env.DB_NAME]);

        if (projColumns.length === 0) {
            console.log('Adding iva_context column to projects...');
            await db.query(`ALTER TABLE projects ADD COLUMN iva_context JSON`);
            console.log('✅ projects.iva_context added');
        } else {
            console.log('ℹ️ projects.iva_context already exists');
        }

        // Add iva_preferences to users table
        console.log('Checking users table for iva_preferences column...');
        const [userColumns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'iva_preferences'
        `, [process.env.DB_NAME]);

        if (userColumns.length === 0) {
            console.log('Adding iva_preferences column to users...');
            await db.query(`ALTER TABLE users ADD COLUMN iva_preferences JSON`);
            console.log('✅ users.iva_preferences added');
        } else {
            console.log('ℹ️ users.iva_preferences already exists');
        }

        // Set default context for existing projects (MySQL compatible JSON update)
        // Note: JSON_OBJECT is MySQL syntax, jsonb_build_object is Postgres
        console.log('Setting default context for existing projects...');

        // We handle null/empty check safely
        await db.query(`
            UPDATE projects 
            SET iva_context = JSON_OBJECT(
                'business_type', 'general',
                'tone', 'formal',
                'custom_instructions', ''
            )
            WHERE iva_context IS NULL 
        `);

        console.log('✅ Default context set for existing projects');

        console.log('✅ IVA context migration completed successfully!');
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

