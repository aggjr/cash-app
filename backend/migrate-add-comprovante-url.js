const db = require('./config/database');

async function migrateComprovanteUrl() {
    console.log('Starting migration: Adding comprovante_url column...');

    const tables = ['producao_revenda'];
    let connection;

    try {
        connection = await db.getConnection();

        for (const table of tables) {
            try {
                // Check if column exists
                const [columns] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE 'comprovante_url'`);

                if (columns.length === 0) {
                    console.log(`Adding comprovante_url to ${table}...`);
                    await connection.query(`ALTER TABLE ${table} ADD COLUMN comprovante_url VARCHAR(255) DEFAULT NULL AFTER forma_pagamento`);
                    console.log(`Successfully added comprovante_url to ${table}`);
                } else {
                    console.log(`Column comprovante_url already exists in ${table}`);
                }
            } catch (err) {
                // Try adding without assuming previous column position if 'AFTER' fails, or just default add
                if (err.code === 'ER_BAD_FIELD_ERROR') {
                    // fall back
                    console.log(`Retrying add without AFTER clause for ${table}...`);
                    await connection.query(`ALTER TABLE ${table} ADD COLUMN comprovante_url VARCHAR(255) DEFAULT NULL`);
                } else {
                    console.error(`Error processing table ${table}:`, err.message);
                }
            }
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateComprovanteUrl;

if (require.main === module) {
    migrateComprovanteUrl()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
