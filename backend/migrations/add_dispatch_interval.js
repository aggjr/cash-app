const db = require('../config/database');

async function addDispatchInterval() {
    try {
        console.log('🚀 Adicionando coluna dispatch_interval_seconds à tabela campanhas...');

        // Check if column already exists
        const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'campanhas' 
        AND COLUMN_NAME = 'dispatch_interval_seconds'
    `);

        if (columns.length > 0) {
            console.log('⚠️  Coluna dispatch_interval_seconds já existe. Pulando...');
            return;
        }

        // Add the column
        await db.query(`
      ALTER TABLE campanhas 
      ADD COLUMN dispatch_interval_seconds INT DEFAULT 120 
      AFTER status
    `);

        console.log('✅ Coluna dispatch_interval_seconds adicionada com sucesso!');
        console.log('   - Tipo: INT');
        console.log('   - Valor padrão: 120 (2 minutos)');
        console.log('   - Posição: Após coluna "status"');

    } catch (error) {
        console.error('❌ Erro ao adicionar coluna dispatch_interval_seconds:', error.message);
        throw error;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    addDispatchInterval()
        .then(() => {
            console.log('\n✅ Migration concluída!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration falhou:', error);
            process.exit(1);
        });
}

module.exports = addDispatchInterval;
