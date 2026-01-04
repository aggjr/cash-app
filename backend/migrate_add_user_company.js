const db = require('./config/database');

async function migrateAddUserCompany() {
    let connection;
    try {
        connection = await db.pool.getConnection();

        // Check if column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'project_users' 
            AND COLUMN_NAME = 'company_id'
        `);

        if (columns.length === 0) {
            console.log('🔄 Adding company_id column to project_users table...');

            // Add column without FK first (nullable to start, or default logic if needed)
            // User requested mandatory, but existing rows need a strategy. 
            // We'll make it NULLable initially for existing rows, but UI will enforce.
            // Or better: Add it, and let it be NULL for old records.
            await connection.query('ALTER TABLE project_users ADD COLUMN company_id INT DEFAULT NULL');

            // Add Foreign Key
            await connection.query('ALTER TABLE project_users ADD CONSTRAINT fk_project_users_company FOREIGN KEY (company_id) REFERENCES empresas(id) ON DELETE SET NULL');

            console.log('✅ company_id column added successfully.');
        } else {
            console.log('✅ company_id column already exists, skipping.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateAddUserCompany;
