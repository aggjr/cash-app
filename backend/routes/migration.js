const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Endpoint temporário para executar migration de marketing
// REMOVER APÓS USO!
router.get('/run-marketing-migration', async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();

        console.log('🚀 Executando migration de Marketing...');

        const tables = [];

        // 1. Características
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
        tables.push('caracteristicas');

        // 2. Grupos de Leads
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
        tables.push('grupos_leads');

        // 3. Composição de Grupos
        await connection.query(`
      CREATE TABLE IF NOT EXISTS grupos_composicao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grupo_pai_id INT NOT NULL,
        grupo_filho_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_pai_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
        FOREIGN KEY (grupo_filho_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
        UNIQUE KEY unique_composicao (grupo_pai_id, grupo_filho_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        tables.push('grupos_composicao');

        // 4. Grupos-Características
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
        tables.push('grupos_caracteristicas');

        // 5. Leads
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
        tables.push('leads');

        // 6. Campanhas
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
        tables.push('campanhas');

        // 7. Leads-Campanhas
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
        tables.push('leads_campanhas');

        // 8. Grupos-Campanhas
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
        tables.push('grupos_campanhas');

        console.log('✅ Migration concluída!');

        res.json({
            success: true,
            message: 'Tabelas de Marketing criadas com sucesso!',
            tables: tables,
            count: tables.length
        });

    } catch (error) {
        console.error('❌ Erro na migration:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
