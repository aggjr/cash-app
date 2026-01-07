const db = require('./config/db');

async function migrate() {
    try {
        console.log('Adding last_iva_access column to users table...');

        await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_iva_access TIMESTAMP NULL
    `);

        console.log('✅ Column last_iva_access added successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        process.exit(0);
    }
}

migrate();
