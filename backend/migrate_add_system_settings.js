const db = require('./config/database');

async function addSystemSettings() {
    let connection;
    try {
        connection = await db.getConnection();

        console.log('🔍 Verificando se a tabela system_settings já existe...');

        // Verifica se a tabela já existe
        const [tables] = await connection.query(`
            SHOW TABLES LIKE 'system_settings'
        `);

        if (tables.length > 0) {
            console.log('✅ Tabela system_settings já existe');
            return;
        }

        console.log('📝 Criando tabela system_settings...');

        await connection.query(`
            CREATE TABLE system_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                numero_dias INT DEFAULT 3,
                tempo_minutos_liberacao INT DEFAULT 5,
                unlock_expires_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                UNIQUE KEY (project_id)
            )
        `);

        console.log('✅ Tabela system_settings criada com sucesso!');

        // Inicializar configurações padrão para todos os projetos existentes
        console.log('📝 Inicializando configurações padrão para projetos existentes...');

        await connection.query(`
            INSERT INTO system_settings (project_id, numero_dias, tempo_minutos_liberacao)
            SELECT id, 3, 5
            FROM projects
            WHERE id NOT IN (SELECT project_id FROM system_settings)
        `);

        console.log('✅ Configurações padrão inicializadas!');

        // Verifica o resultado
        const [result] = await connection.query(`
            SHOW CREATE TABLE system_settings
        `);

        console.log('📊 Estrutura da tabela:', result[0]);

    } catch (error) {
        console.error('❌ Erro ao criar tabela system_settings:', error.message);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// Executa se for chamado diretamente
if (require.main === module) {
    addSystemSettings()
        .then(() => {
            console.log('✅ Migração concluída com sucesso!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Erro na migração:', error);
            process.exit(1);
        });
}

module.exports = addSystemSettings;
