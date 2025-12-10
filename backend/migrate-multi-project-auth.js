const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'cash_db'
};

async function columnExists(connection, table, column) {
    const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `, [dbConfig.database, table, column]);
    return columns.length > 0;
}

async function migrate() {
    let connection;

    try {
        console.log('🔄 Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected!\n');

        // Step 1: Add password columns to project_users (if not exists)
        console.log('📝 Step 1: Adding password columns to project_users...');

        const hasPassword = await columnExists(connection, 'project_users', 'password');
        const hasPasswordReset = await columnExists(connection, 'project_users', 'password_reset_required');

        if (!hasPassword) {
            await connection.query(`ALTER TABLE project_users ADD COLUMN password VARCHAR(255) NULL AFTER user_id`);
            console.log('   ✅ Added password column');
        } else {
            console.log('   ⏭️  password column already exists');
        }

        if (!hasPasswordReset) {
            await connection.query(`ALTER TABLE project_users ADD COLUMN password_reset_required BOOLEAN DEFAULT FALSE AFTER password`);
            console.log('   ✅ Added password_reset_required column');
        } else {
            console.log('   ⏭️  password_reset_required column already exists');
        }

        // Step 2: Migrate passwords
        console.log('\n📝 Step 2: Migrating passwords from users to project_users...');

        // Check if users table still has password column
        const usersHasPassword = await columnExists(connection, 'users', 'password');

        if (usersHasPassword) {
            const [result] = await connection.query(`
                UPDATE project_users pu
                INNER JOIN users u ON pu.user_id = u.id
                SET pu.password = u.password,
                    pu.password_reset_required = COALESCE(u.password_reset_required, FALSE)
                WHERE pu.password IS NULL
            `);
            console.log(`   ✅ Migrated ${result.affectedRows} records`);
        } else {
            console.log('   ⏭️  users table no longer has password column (already migrated)');
        }

        // Step 3: Make password NOT NULL
        console.log('\n📝 Step 3: Making password column NOT NULL...');
        const [nullCheck] = await connection.query(`
            SELECT COUNT(*) as count FROM project_users WHERE password IS NULL
        `);

        if (nullCheck[0].count > 0) {
            console.log(`   ⚠️  WARNING: ${nullCheck[0].count} records have NULL password. Cannot make NOT NULL.`);
        } else {
            await connection.query(`
                ALTER TABLE project_users
                MODIFY COLUMN password VARCHAR(255) NOT NULL
            `);
            console.log('   ✅ Password column is now required');
        }

        // Step 4: Remove password columns from users
        console.log('\n📝 Step 4: Removing password columns from users table...');

        if (usersHasPassword) {
            await connection.query(`ALTER TABLE users DROP COLUMN password`);
            console.log('   ✅ Dropped password column');
        }

        if (await columnExists(connection, 'users', 'password_reset_required')) {
            await connection.query(`ALTER TABLE users DROP COLUMN password_reset_required`);
            console.log('   ✅ Dropped password_reset_required column');
        }

        if (await columnExists(connection, 'users', 'password_reset_token')) {
            await connection.query(`ALTER TABLE users DROP COLUMN password_reset_token`);
            console.log('   ✅ Dropped password_reset_token column');
        }

        if (await columnExists(connection, 'users', 'password_reset_expires')) {
            await connection.query(`ALTER TABLE users DROP COLUMN password_reset_expires`);
            console.log('   ✅ Dropped password_reset_expires column');
        }

        // Verification
        console.log('\n🔍 Verification:');
        const [verification] = await connection.query(`
            SELECT 
                u.email,
                p.name as project_name,
                pu.role,
                LENGTH(pu.password) as password_length,
                pu.password_reset_required
            FROM project_users pu
            INNER JOIN users u ON pu.user_id = u.id
            INNER JOIN projects p ON pu.project_id = p.id
            ORDER BY u.email, p.name
        `);

        console.table(verification);

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Total project-user relationships: ${verification.length}`);
        console.log(`   - All passwords migrated: ${verification.every(v => v.password_length > 0)}`);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

migrate();
