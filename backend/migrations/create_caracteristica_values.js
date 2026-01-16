const db = require('../config/database');

async function createCaracteristicaValoresTable() {
    try {
        console.log('🚀 Iniciando criação da tabela caracteristica_valores...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS caracteristica_valores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                caracteristica_id INT NOT NULL,
                valor VARCHAR(255) NOT NULL,
                ordem INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (caracteristica_id) REFERENCES caracteristicas(id) ON DELETE CASCADE,
                UNIQUE KEY unique_valor_caracteristica (caracteristica_id, valor)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Tabela "caracteristica_valores" criada/verificada com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao criar tabela caracteristica_valores:', error);
        throw error;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    createCaracteristicaValoresTable()
        .then(() => {
            console.log('\n✅ Migration concluída!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration falhou:', error);
            process.exit(1);
        });
}

module.exports = createCaracteristicaValoresTable;
