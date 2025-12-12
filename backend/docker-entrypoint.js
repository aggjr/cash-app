const { exec } = require('child_process');
const mysql = require('mysql2/promise');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDB() {
    console.log('⏳ Waiting for Database...');
    const maxRetries = 30;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                port: process.env.DB_PORT || 3306
            });
            await connection.end();
            console.log('✅ Database is ready!');
            return true;
        } catch (error) {
            console.log(`... Database not ready yet (${i + 1}/${maxRetries}). Retrying in 2s...`);
            await sleep(2000);
        }
    }
    throw new Error('Timeout waiting for database');
}

async function runMigrations() {
    console.log('\n═══════════════════════════════════════');
    console.log('🚀 CASH Docker Entrypoint - Starting Migrations');
    console.log('⏰ Started at:', new Date().toISOString());
    console.log('🌍 Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('═══════════════════════════════════════\n');
    console.log('🚀 Checking for Database Reset...');

    // FORCE DB RESET (As requested by user for this deploy)
    console.log('⚠️  FORCING DATABASE RESET (init.sql) ⚠️');
    try {
        await new Promise((resolve, reject) => {
            const child = exec('node execute-init-sql.js', { cwd: __dirname });
            child.stdout.on('data', data => console.log(data));
            child.stderr.on('data', data => console.error(data));
            child.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`Reset failed with code ${code}`));
            });
        });
    } catch (e) {
        console.error('❌ DB Reset Failed:', e);
        console.error('⚠️  Continuing startup (migrations might match existing schema or fail)...');
        // Do NOT exit, allowing valid startup if DB was already fine or error was transient.
    }

    console.log('🚀 Running Migrations (Post-Reset)...');

    // List of migration scripts to run in order
    const migrations = [
        'emergency-fix-schema.js', // EMERGENCY: Force correct schema
        'fix-empresas-schema.js', // FIX: Add description to empresas
        'cleanup-orphaned-data.js', // CLEANUP: Remove orphaned records
        // 'migrate-recreate-base-tables.js', // Skip, init.sql did this
        // 'migrate-auth.js', // SKIP - Conflicts with init.sql (recreates users table with password NOT NULL)
        // 'migrate-user-management.js', // SKIP - Adds columns that conflict with schema
        // 'migrate-multi-project-auth.js', // SKIP - Tries to migrate passwords that don't exist
        // 'migrate-empresas.js', // Error: Unknown column description (init.sql handles table creation)
        'migrate-accounts.js',
        'update-accounts-schema.js',
        // 'migrate-entradas.cjs', // Error: SQL file missing (init.sql handles table creation)
        // 'migrate-saidas.js', // Error: Module not found (init.sql handles table creation)
        'migrate-error-catalog.js'
    ];

    for (const script of migrations) {
        console.log(`   Running ${script}...`);
        await new Promise((resolve, reject) => {
            exec(`node ${script}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing ${script}:`, stderr);
                    // Decide if we should fail or continue. ideally fail.
                    // But for now, let's log and continue to avoid full crash on repeated runs of non-idempotent scripts
                } else {
                    console.log(stdout);
                }
                resolve();
            });
        });
    }
    console.log('✅ Migrations completed.');
}

async function startServer() {
    try {
        await waitForDB();
        await runMigrations();

        console.log('🟢 Starting Server...');
        require('./server.js');
    } catch (error) {
        console.error('❌ Failed to start:', error);
        process.exit(1);
    }
}

startServer();
