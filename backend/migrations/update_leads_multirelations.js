const db = require('../config/database');

async function updateLeadsMultiRelations() {
    try {
        console.log('🚀 Iniciando migração para Leads Multi-Grupos e Multi-Características...');

        // 1. Criar tabela leads_grupos
        await db.query(`
            CREATE TABLE IF NOT EXISTS leads_grupos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lead_id INT NOT NULL,
                grupo_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
                FOREIGN KEY (grupo_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
                UNIQUE KEY unique_lead_grupo (lead_id, grupo_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela "leads_grupos" verificada/criada');

        // 2. Criar tabela leads_caracteristicas
        await db.query(`
            CREATE TABLE IF NOT EXISTS leads_caracteristicas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lead_id INT NOT NULL,
                caracteristica_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
                FOREIGN KEY (caracteristica_id) REFERENCES caracteristicas(id) ON DELETE CASCADE,
                UNIQUE KEY unique_lead_caracteristica (lead_id, caracteristica_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela "leads_caracteristicas" verificada/criada');

        // 3. Migrar dados existentes (grupo_id -> leads_grupos)
        // Verifica se a coluna grupo_id ainda existe
        const [columns] = await db.query(`SHOW COLUMNS FROM leads LIKE 'grupo_id'`);

        if (columns.length > 0) {
            console.log('🔄 Migrando dados da coluna antiga grupo_id...');

            // Copiar dados
            await db.query(`
                INSERT IGNORE INTO leads_grupos (lead_id, grupo_id)
                SELECT id, grupo_id FROM leads WHERE grupo_id IS NOT NULL
            `);
            console.log('✅ Dados migrados para leads_grupos');

            // Dropar Foreign Key antiga (precisamos descobrir o nome se não for padrão, mas tentaremos pelo nome provável)
            try {
                // Tenta descobrir o nome da FK
                const [fks] = await db.query(`
                    SELECT CONSTRAINT_NAME 
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_NAME = 'leads' 
                    AND COLUMN_NAME = 'grupo_id' 
                    AND TABLE_SCHEMA = DATABASE()
                `);

                if (fks.length > 0) {
                    const fkName = fks[0].CONSTRAINT_NAME;
                    await db.query(`ALTER TABLE leads DROP FOREIGN KEY ${fkName}`);
                    console.log(`✅ FK ${fkName} removida`);
                }
            } catch (fkError) {
                console.log('⚠️ Aviso ao remover FK (pode já não existir):', fkError.message);
            }

            // Dropar coluna
            /* 
               NOTA: Por segurança, vou manter a coluna por enquanto mas deixá-la NULLABLE e sem uso no novo código.
               Se o usuário quiser limpar depois, fazemos um cleanup.
               Isso evita perda de dados acidental se o script rodar errado.
               Mas vou remover o INDEX idx_grupo para evitar confusão.
            */
            try {
                await db.query(`DROP INDEX idx_grupo ON leads`);
            } catch (e) { /* Index pode não existir ou já ter ido */ }

            console.log('✅ Migração de schema concluída (coluna grupo_id mantida pro-forma mas dados migrados)');
        }

    } catch (error) {
        console.error('❌ Erro na migração updateLeadsMultiRelations:', error);
    }
}

module.exports = updateLeadsMultiRelations;
