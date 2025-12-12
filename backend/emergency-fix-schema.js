const db = require('../config/database');

async function forceSchemaFix() {
    console.log('🚨 EMERGENCY SCHEMA FIX - Forcing correct users table schema');

    try {
        const connection = await db.getConnection();

        console.log('Checking users table structure...');
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'cash'}'
            AND TABLE_NAME = 'users'
        `);

        console.log('Current users table columns:', columns);

        // Remove password column if it exists
        const hasPassword = columns.some(col => col.COLUMN_NAME === 'password');
        if (hasPassword) {
            console.log('⚠️  Removing password column from users table...');
            await connection.query('ALTER TABLE users DROP COLUMN password');
            console.log('✅ Password column removed');
        } else {
            console.log('✅ Password column already removed');
        }

        // Remove password_reset_required if it exists
        const hasPasswordReset = columns.some(col => col.COLUMN_NAME === 'password_reset_required');
        if (hasPasswordReset) {
            console.log('⚠️  Removing password_reset_required column...');
            await connection.query('ALTER TABLE users DROP COLUMN password_reset_required');
            console.log('✅ password_reset_required removed');
        }

        // Remove password_reset_token if it exists
        const hasPasswordToken = columns.some(col => col.COLUMN_NAME === 'password_reset_token');
        if (hasPasswordToken) {
            console.log('⚠️  Removing password_reset_token column...');
            await connection.query('ALTER TABLE users DROP COLUMN password_reset_token');
            console.log('✅ password_reset_token removed');
        }

        // Remove password_reset_expires if it exists
        const hasPasswordExpires = columns.some(col => col.COLUMN_NAME === 'password_reset_expires');
        if (hasPasswordExpires) {
            console.log('⚠️  Removing password_reset_expires column...');
            await connection.query('ALTER TABLE users DROP COLUMN password_reset_expires');
            console.log('✅ password_reset_expires removed');
        }

        // Remove project_id if it exists
        const hasProjectId = columns.some(col => col.COLUMN_NAME === 'project_id');
        if (hasProjectId) {
            console.log('⚠️  Removing project_id column...');
            await connection.query('ALTER TABLE users DROP FOREIGN KEY users_ibfk_1').catch(() => {
                console.log('   (No foreign key to drop)');
            });
            await connection.query('ALTER TABLE users DROP COLUMN project_id');
            console.log('✅ project_id removed');
        }

        // Ensure is_active exists
        const hasIsActive = columns.some(col => col.COLUMN_NAME === 'is_active');
        if (!hasIsActive) {
            console.log('⚠️  Adding is_active column...');
            await connection.query('ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1');
            console.log('✅ is_active added');
        } else {
            console.log('✅ is_active already exists');
        }

        connection.release();
        console.log('✅ Schema fix completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error fixing schema:', error);
        process.exit(1);
    }
}

forceSchemaFix();
