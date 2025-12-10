// Migration script for user management system
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateUserManagement() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        console.log('✓ Connected to database');

        // Add columns to users table
        console.log('Updating users table...');

        const userColumns = [
            { name: 'password_reset_required', type: 'BOOLEAN DEFAULT FALSE' },
            { name: 'password_reset_token', type: 'VARCHAR(255) NULL' },
            { name: 'password_reset_expires', type: 'DATETIME NULL' },
            { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
            { name: 'invited_by', type: 'INT NULL' },
            { name: 'invited_at', type: 'TIMESTAMP NULL' }
        ];

        for (const col of userColumns) {
            try {
                await connection.execute(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
                console.log(`  ✓ Added ${col.name} to users`);
            } catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    console.log(`  - ${col.name} already exists in users`);
                } else {
                    throw error;
                }
            }
        }

        // Add columns to project_users table
        console.log('Updating project_users table...');

        const projectUserColumns = [
            { name: 'invited_by', type: 'INT NULL' },
            { name: 'invited_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
            { name: 'joined_at', type: 'TIMESTAMP NULL' },
            { name: 'status', type: "ENUM('pending', 'active', 'inactive') DEFAULT 'active'" }
        ];

        for (const col of projectUserColumns) {
            try {
                await connection.execute(`ALTER TABLE project_users ADD COLUMN ${col.name} ${col.type}`);
                console.log(`  ✓ Added ${col.name} to project_users`);
            } catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    console.log(`  - ${col.name} already exists in project_users`);
                } else {
                    throw error;
                }
            }
        }

        // Add indexes
        console.log('Adding indexes...');
        try {
            await connection.execute('CREATE INDEX idx_password_reset_token ON users(password_reset_token)');
            console.log('  ✓ Added index on password_reset_token');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('  - Index idx_password_reset_token already exists');
            } else {
                throw error;
            }
        }

        console.log('\n✓ Migration completed successfully');

        // Show updated structure
        const [userCols] = await connection.execute('DESCRIBE users');
        console.log('\nUsers table structure:');
        console.table(userCols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Default: c.Default })));

    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✓ Database connection closed');
        }
    }
}

migrateUserManagement();
