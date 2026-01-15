const db = require('../config/database');

async function createMarketingTables() {
  let connection;
  try {
    connection = await db.getConnection();

    console.log('🚀 Iniciando criação das tabelas de Marketing...');

    // 1. Tabela de Características
    await connection.query(`
      CREATE TABLE IF NOT EXISTS caracteristicas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        descricao TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_nome (nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela "caracteristicas" criada');

    // 2. Tabela de Grupos de Leads
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grupos_leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        descricao TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_nome (nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela "grupos_leads" criada');

    // 3. Tabela de Composição de Grupos
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grupos_composicao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grupo_pai_id INT NOT NULL,
        grupo_filho_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_pai_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
        FOREIGN KEY (grupo_filho_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
        UNIQUE KEY unique_composicao (grupo_pai_id, grupo_filho_id),
        CHECK (grupo_pai_id != grupo_filho_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela "grupos_composicao" criada');

    // 4. Tabela de Relacionamento Grupos-Características
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grupos_caracteristicas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grupo_id INT NOT NULL,
        caracteristica_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
        FOREIGN KEY (caracteristica_id) REFERENCES caracteristicas(id) ON DELETE CASCADE,
        UNIQUE KEY unique_grupo_caracteristica (grupo_id, caracteristica_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela "grupos_caracteristicas" criada');

    // 5. Tabela de Leads
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        email VARCHAR(150),
        telefone VARCHAR(20),
        grupo_id INT,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_id) REFERENCES grupos_leads(id) ON DELETE SET NULL,
        INDEX idx_grupo (grupo_id),
        INDEX idx_email (email),
        INDEX idx_nome (nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela "leads" criada');

    // 6. Tabela de Campanhas
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campanhas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        descricao TEXT,
        data_inicio DATE,
        data_fim DATE,
        status ENUM('planejamento', 'ativa', 'pausada', 'concluida', 'cancelada') DEFAULT 'planejamento',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_datas (data_inicio, data_fim)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela "campanhas" criada');

    // 7. Tabela de Relacionamento Leads-Campanhas
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leads_campanhas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        campanha_id INT NOT NULL,
        data_associacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pendente', 'contatado', 'respondeu', 'converteu', 'rejeitou') DEFAULT 'pendente',
        observacoes TEXT,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE,
        UNIQUE KEY unique_lead_campanha (lead_id, campanha_id),
        INDEX idx_campanha (campanha_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela "leads_campanhas" criada');

    // 8. Tabela de Relacionamento Grupos-Campanhas
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grupos_campanhas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grupo_id INT NOT NULL,
        campanha_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
        FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE,
        UNIQUE KEY unique_grupo_campanha (grupo_id, campanha_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela "grupos_campanhas" criada');

    console.log('\n🎉 Todas as tabelas de Marketing foram criadas com sucesso!');
    console.log('\n📊 Resumo:');
    console.log('   - caracteristicas');
    console.log('   - grupos_leads');
    console.log('   - grupos_composicao (hierarquia)');
    console.log('   - grupos_caracteristicas (N:N)');
    console.log('   - leads');
    console.log('   - campanhas');
    console.log('   - leads_campanhas (N:N)');
    console.log('   - grupos_campanhas (N:N)');

  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  createMarketingTables()
    .then(() => {
      console.log('\n✅ Migration concluída!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration falhou:', error);
      process.exit(1);
    });
}

module.exports = createMarketingTables;
