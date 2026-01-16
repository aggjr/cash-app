const db = require('../config/database');

async function updateLeadsCharsValues() {
    try {
        console.log('🚀 Iniciando migração da tabela leads_caracteristicas (valor_id)...');

        // Check if column exists
        const [columns] = await db.query(`
      SHOW COLUMNS FROM leads_caracteristicas LIKE 'valor_id'
    `);

        if (columns.length === 0) {
            await db.query(`
        ALTER TABLE leads_caracteristicas
        ADD COLUMN valor_id INT NULL,
        ADD FOREIGN KEY (valor_id) REFERENCES caracteristica_valores(id) ON DELETE SET NULL
      `);
            console.log('✅ Coluna "valor_id" adicionada com sucesso!');
        } else {
            console.log('ℹ️ Coluna "valor_id" já existe. Pulando.');
        }

        console.log('✅ Migração leads_caracteristicas concluída!');

    } catch (error) {
        console.error('❌ Erro na migração leads_caracteristicas:', error);
        throw error;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    updateLeadsCharsValues()
        .then(() => {
            console.log('\n✅ Migration concluída!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration falhou:', error);
            process.exit(1);
        });
}

module.exports = updateLeadsCharsValues;
