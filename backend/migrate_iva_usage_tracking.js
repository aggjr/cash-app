const mysql = require('mysql2/promise');
const dbConfig = require('./config/database');

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);

    try {
        console.log('Creating iva_usage_tracking table...');

        await connection.query(`
      CREATE TABLE IF NOT EXISTS iva_usage_tracking (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        project_id INT NOT NULL,
        interaction_type ENUM('chat', 'operate', 'learn') NOT NULL,
        
        -- Token usage
        prompt_tokens INT NOT NULL,
        completion_tokens INT NOT NULL,
        total_tokens INT NOT NULL,
        
        -- Cost calculation
        prompt_cost DECIMAL(10, 6) NOT NULL,
        completion_cost DECIMAL(10, 6) NOT NULL,
        total_cost DECIMAL(10, 6) NOT NULL,
        
        -- Context
        model VARCHAR(50) DEFAULT 'gpt-4o-mini',
        has_knowledge BOOLEAN DEFAULT false,
        knowledge_size INT DEFAULT 0,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_user (user_id),
        INDEX idx_project (project_id),
        INDEX idx_user_project (user_id, project_id),
        INDEX idx_date (created_at),
        INDEX idx_type (interaction_type),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

        console.log('✅ Table created successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

migrate()
    .then(() => {
        console.log('Migration completed!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Migration error:', err);
        process.exit(1);
    });
