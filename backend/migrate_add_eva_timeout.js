const db = require('./config/database');

async function migrate() {
    console.log('🔄 Iniciando migração: Adicionar eva_timeout em system_settings...');
    const connection = await db.getConnection();

    try {
        // Verificar se a coluna já existe
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM system_settings LIKE 'eva_timeout'
        `);

        if (columns.length > 0) {
            console.log('⚠️ Coluna eva_timeout já existe. Pulando.');
        } else {
            console.log('➕ Adicionando coluna eva_timeout...');
            await connection.query(`
                ALTER TABLE system_settings
                ADD COLUMN eva_timeout INT DEFAULT 5
            `);
            console.log('✅ Coluna adicionada com sucesso!');

            // Update existing rows to default 5
            await connection.query(`UPDATE system_settings SET eva_timeout = 5 WHERE eva_timeout IS NULL`);
        }

    } catch (error) {
        console.error('❌ Erro na migração:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

migrate();
