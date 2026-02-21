const db = require('./config/database');

async function addBoletoUrlColumn() {
    let connection;
    try {
        connection = await db.getConnection();

        const tables = ['entradas', 'saidas'];

        for (const table of tables) {
            console.log(`\n🔍 Verificando se a coluna boleto_url já existe em ${table}...`);

            // Verifica se a coluna já existe
            const [columns] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = ? 
                AND COLUMN_NAME = 'boleto_url'
            `, [table]);

            if (columns.length > 0) {
                console.log(`✅ Coluna boleto_url já existe na tabela ${table}`);
                continue;
            }

            console.log(`📝 Adicionando coluna boleto_url à tabela ${table}...`);

            await connection.query(`
                ALTER TABLE ${table} 
                ADD COLUMN boleto_url VARCHAR(255) DEFAULT NULL
            `);

            console.log(`✅ Coluna boleto_url adicionada com sucesso na tabela ${table}!`);
        }

    } catch (error) {
        console.error('❌ Erro ao adicionar coluna boleto_url:', error.message);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// Executa se for chamado diretamente
if (require.main === module) {
    addBoletoUrlColumn()
        .then(() => {
            console.log('✅ Migração concluída com sucesso!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Erro na migração:', error);
            process.exit(1);
        });
}

module.exports = addBoletoUrlColumn;
