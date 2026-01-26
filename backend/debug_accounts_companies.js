const db = require('./config/database');

async function debugAccountsCompanies() {
    try {
        console.log('\n========== COMPANIES ==========');
        const [companies] = await db.query(
            'SELECT id, name FROM companies ORDER BY id'
        );
        console.log('All Companies:');
        companies.forEach(c => {
            console.log(`  ID: ${c.id} | Name: ${c.name}`);
        });

        console.log('\n========== ACCOUNTS ==========');
        const [accounts] = await db.query(
            'SELECT id, name, company_id FROM accounts ORDER BY company_id, id'
        );
        console.log('All Accounts:');
        accounts.forEach(a => {
            const company = companies.find(c => c.id === a.company_id);
            console.log(`  ID: ${a.id} | Name: ${a.name} | Company ID: ${a.company_id} | Company Name: ${company ? company.name : 'NOT FOUND'}`);
        });

        console.log('\n========== ACCOUNTS BY COMPANY ==========');
        companies.forEach(company => {
            const companyAccounts = accounts.filter(a => a.company_id === company.id);
            console.log(`\nCompany: ${company.name} (ID: ${company.id})`);
            if (companyAccounts.length === 0) {
                console.log('  No accounts');
            } else {
                companyAccounts.forEach(a => {
                    console.log(`  - ${a.name} (ID: ${a.id})`);
                });
            }
        });

        // Check for orphaned accounts
        console.log('\n========== ORPHANED ACCOUNTS ==========');
        const orphaned = accounts.filter(a => !companies.find(c => c.id === a.company_id));
        if (orphaned.length === 0) {
            console.log('No orphaned accounts');
        } else {
            console.log('Accounts with invalid company_id:');
            orphaned.forEach(a => {
                console.log(`  ID: ${a.id} | Name: ${a.name} | Company ID: ${a.company_id} (INVALID)`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugAccountsCompanies();
