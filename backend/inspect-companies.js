const db = require('./config/database');

async function checkCompaniesAndAccounts() {
    try {
        console.log('=== Checking Database Schema ===\n');

        // Show all tables
        const [tables] = await db.query('SHOW TABLES');
        console.log('Available tables:', tables.map(t => Object.values(t)[0]));

        // Check if companies/empresas table exists
        console.log('\n=== Checking Companies/Empresas Table ===');
        try {
            const [companiesCols] = await db.query('DESCRIBE empresas');
            console.log('empresas table structure:');
            console.log(companiesCols);

            const [companies] = await db.query('SELECT * FROM empresas');
            console.log('\nCurrent companies:');
            console.log(companies);
        } catch (e) {
            console.log('empresas table does not exist or error:', e.message);
        }

        // Check accounts table structure
        console.log('\n=== Checking Accounts (contas) Table ===');
        try {
            const [accountsCols] = await db.query('DESCRIBE contas');
            console.log('contas table structure:');
            console.log(accountsCols);

            const [accounts] = await db.query('SELECT * FROM contas LIMIT 5');
            console.log('\nSample accounts:');
            console.log(accounts);
        } catch (e) {
            console.log('contas table error:', e.message);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkCompaniesAndAccounts();
