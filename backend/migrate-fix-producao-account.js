const db = require('./config/database');

async function migrate() {
    let connection;
    try {
        console.log('Starting migration to fix account_id nullability...');
        connection = await db.getConnection();

        // 1. Modify account_id to be NULLable
        console.log('Modifying account_id column...');
        await connection.query(`
            ALTER TABLE producao_revenda 
            MODIFY COLUMN account_id INT NULL COMMENT 'Reference to account (Matches contas.id)'
        `);

        // 2. Also ensure centro_custo_id is NULLable (good practice given previous error)
        console.log('Ensuring centro_custo_id is NULLable...');
        // We need to check if the column exists first to avoid errors if running on clean db vs existing
        // but for now assuming it exists since we got FK error on it earlier.
        await connection.query(`
            ALTER TABLE producao_revenda 
            MODIFY COLUMN centro_custo_id INT NULL COMMENT 'Reference to cost center'
        `);

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

migrate();
