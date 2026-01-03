const db = require('./config/database');

async function addBoletoUrlColumn() {
    let connection;
    try {
        connection = await db.getConnection();

        console.log('🔍 Verificando se a coluna boleto_url já existe...');

        // Verifica se a coluna já existe
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'entradas' 
            AND COLUMN_NAME = 'boleto_url'
        `);

        if (columns.length > 0) {
            console.log('✅ Coluna boleto_url já existe na tabela entradas');
            return;
        }

        console.log('📝 Adicionando coluna boleto_url à tabela entradas...');

        await connection.query(`
            ALTER TABLE entradas 
            ADD COLUMN boleto_url VARCHAR(255) DEFAULT NULL
            AFTER comprovante_url
        `);

        console.log('✅ Coluna boleto_url adicionada com sucesso!');

        // Verifica o resultado
        const [result] = await connection.query(`
            SHOW COLUMNS FROM entradas LIKE 'boleto_url'
        `);

        console.log('📊 Estrutura da coluna:', result[0]);

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
