const db = require('./config/database');

/**
 * Migration: Add IVA Discovered Knowledge System
 * Cria tabela para IVA armazenar conhecimento descoberto dinamicamente
 */

async function migrate() {
    console.log('🔄 Starting IVA Discovered Knowledge migration...');

    try {
        // Criar tabela de conhecimento descoberto
        console.log('Creating iva_discovered_knowledge table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS iva_discovered_knowledge (
                id INT AUTO_INCREMENT PRIMARY KEY,
                
                -- Hierarquia (inicialmente só project e user, depois expandir)
                level ENUM('project', 'user') NOT NULL,
                project_id INT NULL,
                user_id INT NULL,
                
                -- Tipo de conhecimento
                knowledge_type ENUM('navigation', 'capability', 'business_context', 'shortcut') NOT NULL,
                
                -- Dados descobertos (JSON flexível)
                discovered_data JSON NOT NULL,
                /* Exemplos:
                    Navigation: {"screenId": "saidas", "menuPath": ["Transações", "Saídas"], "keywords": [...]}
                    Capability: {"action": "filter_by_type", "screen": "saidas", "elementId": "#filter-tipo"}
                    Business: {"expenseCategories": [...], "inferredIndustry": "consultoria"}
                    Shortcut: {"trigger": "despesas internet", "target": "saidas", "filters": {...}}
                */
                
                -- Metadados de confiança
                confidence_score DECIMAL(3,2) DEFAULT 1.0 COMMENT 'Confiança 0.0 a 1.0',
                usage_count INT DEFAULT 0 COMMENT 'Quantas vezes foi usado',
                success_count INT DEFAULT 0 COMMENT 'Quantas vezes funcionou',
                failure_count INT DEFAULT 0 COMMENT 'Quantas vezes falhou',
                
                -- Timestamps
                discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used_at DATETIME NULL,
                last_validated_at DATETIME NULL,
                
                -- Índices para busca rápida
                INDEX idx_level (level, project_id, user_id),
                INDEX idx_type (knowledge_type),
                INDEX idx_confidence (confidence_score),
                INDEX idx_project (project_id),
                
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ iva_discovered_knowledge table created');

        // Criar tabela de sessões de aprendizado
        console.log('Creating iva_learning_sessions table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS iva_learning_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NULL,
                user_id INT NULL,
                
                session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                session_end DATETIME NULL,
                
                -- Estatísticas da sessão
                discoveries_count INT DEFAULT 0,
                validations_count INT DEFAULT 0,
                errors_count INT DEFAULT 0,
                commands_processed INT DEFAULT 0,
                
                -- Metadados
                session_data JSON NULL COMMENT 'Dados adicionais da sessão',
                
                INDEX idx_user (user_id),
                INDEX idx_project (project_id),
                INDEX idx_dates (session_start, session_end),
                
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ iva_learning_sessions table created');

        console.log('✅ IVA Discovered Knowledge migration completed successfully!');
        return true;

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    migrate()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('Migration error:', err);
            process.exit(1);
        });
}

module.exports = migrate;
