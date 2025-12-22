const db = require('./config/database');

const tables = [
    'saidas',
    'aportes',
    'retiradas',
    'transferencias',
    'producao_revenda',
    'entradas'
];

async function migratePaymentColumns() {
    let connection;
    try {
        connection = await db.getConnection();
        console.log('Running migration: Add Payment Columns...');

        for (const table of tables) {
            try {
                // Check if column exists is hard in pure SQL without query, but ADD COLUMN IF NOT EXISTS is MariaDB 10.2+
                // We will try to add and catch duplicate error which is standard.
                await connection.query(`ALTER TABLE ${table} ADD COLUMN forma_pagamento VARCHAR(50) DEFAULT NULL`);
                console.log(`  -> Added forma_pagamento to ${table}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // console.log(`  -> Column already exists in ${table}`); // Silent success
                } else if (err.code === 'ER_NO_SUCH_TABLE') {
                    console.warn(`  -> Table ${table} does not exist`);
                } else {
                    console.error(`  -> Error in ${table}:`, err.message);
                }
            }
        }
        console.log('Migration Add Payment Columns completed.');
    } catch (err) {
        console.error('Migration Add Payment Columns failed:', err);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migratePaymentColumns;

