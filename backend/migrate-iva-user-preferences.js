const db = require('./config/database');

module.exports = async function migrateEvaPreferences() {
    try {
        console.log('Adding IVA user preference columns to users table...');

        // Add preferred_name
        try {
            await db.query("ALTER TABLE users ADD COLUMN preferred_name VARCHAR(100) NULL");
            console.log('✓ Added preferred_name column');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding preferred_name:', e);
            else console.log('preferred_name column already exists');
        }

        // Add iva_introduced
        try {
            await db.query("ALTER TABLE users ADD COLUMN iva_introduced BOOLEAN DEFAULT FALSE");
            console.log('✓ Added iva_introduced column');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding iva_introduced:', e);
            else console.log('iva_introduced column already exists');
        }

        // Add iva_voice_enabled
        try {
            await db.query("ALTER TABLE users ADD COLUMN iva_voice_enabled BOOLEAN DEFAULT FALSE");
            console.log('✓ Added iva_voice_enabled column');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding iva_voice_enabled:', e);
            else console.log('iva_voice_enabled column already exists');
        }

        console.log('IVA user preferences migration completed successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
        throw e;
    }
};

