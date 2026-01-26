const db = require('./config/database');

/**
 * Migration: Fix Account-Company Associations
 * 
 * Problem: Accounts (Conta BB, DAPAY, Inver) have company_id: 12
 * but should be associated with company "O Juri e o Pericia" (ID: 2)
 * 
 * This script will:
 * 1. Show current state
 * 2. Ask for confirmation
 * 3. Update the associations
 */

async function fixAccountCompanyAssociations() {
    try {
        console.log('\n========== CURRENT STATE ==========');

        // Get all companies
        const [companies] = await db.query('SELECT id, name FROM companies ORDER BY id');
        console.log('\nCompanies:');
        companies.forEach(c => console.log(`  ${c.id}: ${c.name}`));

        // Get all accounts
        const [accounts] = await db.query('SELECT id, name, company_id FROM accounts ORDER BY id');
        console.log('\nAccounts:');
        accounts.forEach(a => {
            const company = companies.find(c => c.id === a.company_id);
            console.log(`  ${a.id}: ${a.name} -> Company ${a.company_id} (${company ? company.name : 'NOT FOUND'})`);
        });

        // Identify the problem accounts (company_id = 12)
        const problemAccounts = accounts.filter(a => a.company_id === 12);

        if (problemAccounts.length === 0) {
            console.log('\n✅ No accounts with company_id = 12 found. Nothing to fix.');
            process.exit(0);
        }

        console.log('\n========== ACCOUNTS TO FIX ==========');
        console.log(`Found ${problemAccounts.length} account(s) with company_id = 12:`);
        problemAccounts.forEach(a => console.log(`  - ${a.name} (ID: ${a.id})`));

        // Find the target company
        const targetCompany = companies.find(c => c.name.includes('Juri') || c.name.includes('Pericia'));

        if (!targetCompany) {
            console.log('\n❌ ERROR: Could not find company "O Juri e o Pericia"');
            console.log('Available companies:');
            companies.forEach(c => console.log(`  ${c.id}: ${c.name}`));
            process.exit(1);
        }

        console.log(`\n📝 Will update these accounts to company: ${targetCompany.name} (ID: ${targetCompany.id})`);
        console.log('\nTo proceed with the update, run this script with --confirm flag:');
        console.log(`  node backend/migrate_fix_account_companies.js --confirm`);

        // Check if --confirm flag is present
        if (process.argv.includes('--confirm')) {
            console.log('\n========== UPDATING ACCOUNTS ==========');

            for (const account of problemAccounts) {
                await db.query(
                    'UPDATE accounts SET company_id = ? WHERE id = ?',
                    [targetCompany.id, account.id]
                );
                console.log(`✅ Updated ${account.name} (ID: ${account.id}) -> Company ${targetCompany.id}`);
            }

            console.log('\n========== VERIFICATION ==========');
            const [updatedAccounts] = await db.query(
                'SELECT id, name, company_id FROM accounts WHERE id IN (?)',
                [problemAccounts.map(a => a.id)]
            );

            console.log('Updated accounts:');
            updatedAccounts.forEach(a => {
                const company = companies.find(c => c.id === a.company_id);
                console.log(`  ${a.id}: ${a.name} -> Company ${a.company_id} (${company ? company.name : 'NOT FOUND'})`);
            });

            console.log('\n✅ Migration completed successfully!');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

fixAccountCompanyAssociations();
