const db = require('./config/database');

async function migrate() {
    console.log('🔄 Iniciando migração: Adicionar iva_timeout em system_settings...');
    const connection = await db.getConnection();

    try {
        // Verificar se a coluna já existe
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM system_settings LIKE 'iva_timeout'
        `);

        if (columns.length > 0) {
            console.log('⚠️ Coluna iva_timeout já existe. Pulando.');
        } else {
            console.log('➕ Adicionando coluna iva_timeout...');
            await connection.query(`
                ALTER TABLE system_settings
                ADD COLUMN iva_timeout INT DEFAULT 5
            `);
            console.log('✅ Coluna adicionada com sucesso!');

            // Update existing rows to default 5
            await connection.query(`UPDATE system_settings SET iva_timeout = 5 WHERE iva_timeout IS NULL`);
        }

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        throw error; // Re-throw to let promise chain handle it
    } finally {
        connection.release();
    }
}

module.exports = migrate;

