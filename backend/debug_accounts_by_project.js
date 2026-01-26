require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugAccountsByProject() {
    let connection;
    try {
        // Create connection directly
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        console.log('\n========== ACCOUNTS BY PROJECT ==========\n');

        // Get all projects
        const [projects] = await connection.execute('SELECT id, name FROM projects ORDER BY id');

        for (const project of projects) {
            console.log(`\n📁 PROJECT: ${project.name} (ID: ${project.id})`);
            console.log('─'.repeat(60));

            // Get companies for this project
            const [companies] = await connection.execute(
                'SELECT id, name FROM companies WHERE project_id = ? ORDER BY id',
                [project.id]
            );

            console.log(`\n  Companies in this project: ${companies.length}`);
            companies.forEach(c => {
                console.log(`    - ${c.name} (ID: ${c.id})`);
            });

            // Get accounts for this project
            const [accounts] = await connection.execute(
                `SELECT a.id, a.name, a.company_id, c.name as company_name 
                 FROM accounts a 
                 LEFT JOIN companies c ON a.company_id = c.id 
                 WHERE a.project_id = ? 
                 ORDER BY a.company_id, a.id`,
                [project.id]
            );

            console.log(`\n  Accounts in this project: ${accounts.length}`);

            if (accounts.length === 0) {
                console.log('    (no accounts)');
            } else {
                // Group by company
                const byCompany = {};
                accounts.forEach(acc => {
                    if (!byCompany[acc.company_id]) {
                        byCompany[acc.company_id] = {
                            company_name: acc.company_name || `Unknown (ID: ${acc.company_id})`,
                            accounts: []
                        };
                    }
                    byCompany[acc.company_id].accounts.push(acc);
                });

                Object.entries(byCompany).forEach(([companyId, data]) => {
                    console.log(`\n    Company: ${data.company_name} (ID: ${companyId})`);
                    data.accounts.forEach(acc => {
                        console.log(`      - ${acc.name} (Account ID: ${acc.id})`);
                    });
                });
            }

            console.log('\n' + '='.repeat(60));
        }

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
        process.exit(0);
    }
}

debugAccountsByProject();
