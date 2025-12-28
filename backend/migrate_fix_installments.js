const db = require('./config/database');

async function migrate() {
    let connection;
    try {
        console.log('🔄 Starting migration...');
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Clean up descriptions
        // MySQL REGEXP replacement is hard, but we can search and update in JS or use specific string functions
        // Since we want to be safe, let's fetch, process, and update.
        console.log('📦 Fetching installments with "Title... - Parcela X/Y" suffix...');

        const [rows] = await connection.query(
            "SELECT id, descricao FROM entradas WHERE descricao LIKE '% - Parcela %'"
        );

        let updatedDescCount = 0;
        for (const row of rows) {
            const newDesc = row.descricao.replace(/ - Parcela \d+\/\d+$/, '').trim();
            if (newDesc !== row.descricao) {
                await connection.query(
                    'UPDATE entradas SET descricao = ? WHERE id = ?',
                    [newDesc, row.id]
                );
                updatedDescCount++;
            }
        }
        console.log(`✅ Cleaned descriptions for ${updatedDescCount} records.`);

        // 2. Fix null intervals
        console.log('🛠 Fixing null installment_interval...');
        const [result] = await connection.query(
            "UPDATE entradas SET installment_interval = 'mensal' WHERE installment_group_id IS NOT NULL AND installment_interval IS NULL"
        );
        console.log(`✅ Updated interval for ${result.affectedRows} records.`);

        await connection.commit();
        console.log('🚀 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        if (connection) await connection.rollback();
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

migrate();
