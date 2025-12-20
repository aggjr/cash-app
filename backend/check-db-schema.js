const db = require('./config/database');

async function checkSchema() {
    try {
        console.log('Checking Schema for RETIRADAS table...');

        const [columns] = await db.query(`
            SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'cash_db' AND TABLE_NAME = 'retiradas';
        `);

        console.table(columns);

        const accountCol = columns.find(c => c.COLUMN_NAME === 'account_id');
        if (accountCol) {
            console.log('\nAccount ID Nullable:', accountCol.IS_NULLABLE);
            if (accountCol.IS_NULLABLE === 'YES') {
                console.log('✅ Schema looks correct (account_id is nullable).');
            } else {
                console.error('❌ Schema is INCORRECT (account_id is NOT nullable).');
            }
        } else {
            console.error('❌ account_id column not found!');
        }

        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
}

checkSchema();
