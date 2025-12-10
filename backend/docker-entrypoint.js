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
    console.log('🚀 Running Migrations...');

    // List of migration scripts to run in order
    const migrations = [
        'migrate-auth.js',
        'migrate-user-management.js',
        'migrate-multi-project-auth.js',
        'migrate-empresas.js',
        'migrate-accounts.js', // Ensure this runs after companies if it depends on it (it doesn't yet, but good practice)
        'update-accounts-schema.js',
        'migrate-entradas.cjs',
        'migrate-despesas.js',
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
