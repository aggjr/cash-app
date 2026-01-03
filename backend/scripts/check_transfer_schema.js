const pool = require('../config/database');

async function checkSchema() {
    try {
        console.log('--- Transferencias ---');
        const [transfers] = await pool.query('DESCRIBE transferencias');
        transfers.forEach(col => console.log(`${col.Field}: ${col.Type} (Null: ${col.Null})`));

        console.log('\n--- Emprestimos ---');
        try {
            const [loans] = await pool.query('DESCRIBE emprestimos');
            loans.forEach(col => console.log(`${col.Field}: ${col.Type} (Null: ${col.Null})`));
        } catch (e) {
            console.log('Table emprestimos might not exist or error:', e.message);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();
