const db = require('./config/database');

async function migrateMakeDescriptionMandatory() {
    console.log('Starting migration: Making "descricao" mandatory...');

    const tables = ['entradas', 'saidas', 'producao_revenda'];
    let connection;

    try {
        connection = await db.getConnection();

        for (const table of tables) {
            console.log(`Processing table: ${table}`);
            try {
                // 1. Update existing NULL or empty descriptions
                console.log(`  - Updating existing empty descriptions...`);
                await connection.query(`
                    UPDATE ${table} 
                    SET descricao = 'Sem descrição' 
                    WHERE descricao IS NULL OR TRIM(descricao) = ''
                `);

                // 2. Modify column to be NOT NULL
                console.log(`  - modifying column to NOT NULL...`);
                // Note: We respecify the full column definition. Assuming VARCHAR(255) is the desired type.
                // We also add a DEFAULT value to be safe.
                await connection.query(`
                    ALTER TABLE ${table} 
                    MODIFY COLUMN descricao VARCHAR(255) NOT NULL DEFAULT 'Sem descrição'
                `);

                console.log(`  - ${table} updated successfully.`);

            } catch (err) {
                console.error(`  - Error processing table ${table}:`, err.message);
                // We continue to next table even if one fails, but log the error.
            }
        }

        console.log('Migration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateMakeDescriptionMandatory;

if (require.main === module) {
    migrateMakeDescriptionMandatory()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
