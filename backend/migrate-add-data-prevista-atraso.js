const db = require('./config/database');

async function migrateDataPrevistaAtraso() {
    console.log('Starting migration: Adding data_prevista_atraso column...');

    const tables = ['producao_revenda', 'saidas'];
    let connection;

    try {
        connection = await db.getConnection();

        for (const table of tables) {
            try {
                // Check if column exists
                const [columns] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE 'data_prevista_atraso'`);

                if (columns.length === 0) {
                    console.log(`Adding data_prevista_atraso to ${table}...`);
                    await connection.query(`ALTER TABLE ${table} ADD COLUMN data_prevista_atraso DATE DEFAULT NULL AFTER data_prevista_pagamento`);
                    console.log(`Successfully added data_prevista_atraso to ${table}`);
                } else {
                    console.log(`Column data_prevista_atraso already exists in ${table}`);
                }
            } catch (err) {
                // Handle case where table might not exist (though unlikely for these core tables)
                console.error(`Error processing table ${table}:`, err.message);
            }
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateDataPrevistaAtraso;

if (require.main === module) {
    migrateDataPrevistaAtraso()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
