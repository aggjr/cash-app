const db = require('../config/database');

async function runMigration() {
    let connection;
    try {
        console.log('Starting migration to add comprovante_url column...');
        connection = await db.getConnection();

        const tables = [
            'entradas',
            'saidas',
            'producao_revenda',
            'aportes',
            'retiradas'
        ];

        for (const table of tables) {
            console.log(`Checking table: ${table}`);

            // Check if column exists
            const [columns] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE 'comprovante_url'`);

            if (columns.length === 0) {
                console.log(`Adding comprovante_url to ${table}...`);
                await connection.query(`ALTER TABLE ${table} ADD COLUMN comprovante_url VARCHAR(255) DEFAULT NULL AFTER descricao`);
                console.log(`✅ Added to ${table}`);
            } else {
                console.log(`ℹ️ Column already exists in ${table}`);
            }
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

runMigration();
