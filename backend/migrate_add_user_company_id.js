const db = require('./config/database');

async function migrate() {
    let connection;
    try {
        connection = await db.getConnection();
        console.log('Starting migration: Add company_id to users table');

        // Check if column already exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'company_id'
        `);

        if (columns.length > 0) {
            console.log('Column company_id already exists in users table. Skipping migration.');
            return;
        }

        // Add company_id column
        await connection.query(`
            ALTER TABLE users 
            ADD COLUMN company_id INT NULL AFTER email
        `);
        console.log('✓ Added company_id column to users table');

        // Add foreign key constraint
        await connection.query(`
            ALTER TABLE users 
            ADD CONSTRAINT fk_users_company 
            FOREIGN KEY (company_id) REFERENCES empresas(id) 
            ON DELETE SET NULL
        `);
        console.log('✓ Added foreign key constraint fk_users_company');

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

migrate();
