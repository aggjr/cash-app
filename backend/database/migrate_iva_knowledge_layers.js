const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cash_flow'
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);

    try {
        console.log('[Migration] Creating iva_knowledge_layers table...');

        // Tabela principal de conhecimento hierárquico
        await connection.query(`
            CREATE TABLE IF NOT EXISTS iva_knowledge_layers (
                id INT PRIMARY KEY AUTO_INCREMENT,
                
                -- Hierarquia (5 camadas)
                layer_type ENUM('GLOBAL', 'MODULE', 'COMPANY', 'SECTOR', 'USER') NOT NULL,
                
                -- Escopo
                module_code VARCHAR(50) NULL COMMENT 'CASH, SUPPLY, RH',
                company_id INT NULL,
                sector_id INT NULL,
                user_id INT NULL,
                
                -- Tipo de Conhecimento (Matriz na camada MODULE)
                knowledge_type ENUM('NAVIGATION', 'ACTION', 'DATA', 'RULE') NOT NULL,
                
                -- Conteúdo
                knowledge_key VARCHAR(255) NOT NULL,
                knowledge_value JSON NOT NULL,
                
                -- Versionamento
                version INT DEFAULT 1,
                previous_value JSON NULL,
                
                -- Metadados de qualidade (aprendizado coletivo)
                priority INT DEFAULT 0,
                confidence_score DECIMAL(3,2) DEFAULT 1.00,
                usage_count INT DEFAULT 0 COMMENT 'Contador de uso coletivo',
                last_used_at DATETIME NULL COMMENT 'Último uso registrado',
                source ENUM('EXPLICIT', 'COLLECTIVE', 'INFERRED', 'IMPORTED') DEFAULT 'EXPLICIT',
                
                -- Status
                active BOOLEAN DEFAULT TRUE,
                deleted_at DATETIME NULL,
                deleted_by INT NULL,
                
                -- Timestamps
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_by INT,
                
                -- Índices
                INDEX idx_layer_module_type (layer_type, module_code, knowledge_type),
                INDEX idx_active (active),
                INDEX idx_key (knowledge_key),
                INDEX idx_usage (usage_count DESC, last_used_at DESC),
                INDEX idx_source (source),
                INDEX idx_company (company_id),
                INDEX idx_user (user_id)
                
                -- Foreign Keys removidas temporariamente (companies table não existe)
                -- FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                -- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Sistema hierárquico de conhecimento da IVA com aprendizado coletivo'
        `);

        console.log('[Migration] ✓ iva_knowledge_layers created');

        // Tabela de auditoria
        console.log('[Migration] Creating iva_knowledge_audit table...');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS iva_knowledge_audit (
                id INT PRIMARY KEY AUTO_INCREMENT,
                knowledge_id INT NOT NULL,
                operation ENUM('LEARN', 'RELEARN', 'UNLEARN') NOT NULL,
                old_value JSON NULL,
                new_value JSON NULL,
                changed_by INT NOT NULL,
                changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                reason TEXT NULL,
                
                INDEX idx_knowledge (knowledge_id),
                INDEX idx_operation (operation),
                INDEX idx_changed_at (changed_at),
                
                FOREIGN KEY (knowledge_id) REFERENCES iva_knowledge_layers(id) ON DELETE CASCADE,
                FOREIGN KEY (changed_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Auditoria de mudanças no conhecimento da IVA'
        `);

        console.log('[Migration] ✓ iva_knowledge_audit created');

        // Tabela de setores (hierarquia organizacional)
        console.log('[Migration] Creating sectors table...');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS sectors (
                id INT PRIMARY KEY AUTO_INCREMENT,
                company_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50) NOT NULL,
                parent_sector_id INT NULL COMMENT 'Hierarquia de setores',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_company (company_id),
                UNIQUE KEY uk_company_code (company_id, code)
                
                -- Foreign Keys removidas (companies table não existe)
                -- FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                -- FOREIGN KEY (parent_sector_id) REFERENCES sectors(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Setores/Departamentos para conhecimento hierárquico'
        `);

        console.log('[Migration] ✓ sectors created');

        // Tabela de controle de primeiro acesso
        console.log('[Migration] Creating iva_access_log table...');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS iva_access_log (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                access_date DATE NOT NULL,
                first_access_time TIME NOT NULL,
                last_access_time TIME NOT NULL,
                total_interactions INT DEFAULT 1,
                
                INDEX idx_user_date (user_id, access_date),
                UNIQUE KEY uk_user_date (user_id, access_date),
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Controle de primeiro acesso diário para cumprimentos'
        `);

        console.log('[Migration] ✓ iva_access_log created');

        console.log('[Migration] ✅ All tables created successfully!');

    } catch (error) {
        console.error('[Migration] ❌ Error:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

// Executar migration
migrate()
    .then(() => {
        console.log('[Migration] Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('[Migration] Migration failed:', error);
        process.exit(1);
    });
