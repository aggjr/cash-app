const db = require('./config/db');

async function migrate() {
    try {
        console.log('Creating iva_usage_tracking table...');

        await db.query(`
      CREATE TABLE IF NOT EXISTS iva_usage_tracking (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        project_id INT NOT NULL,
        interaction_type ENUM('chat', 'operate', 'learn') NOT NULL,
        
        prompt_tokens INT NOT NULL,
        completion_tokens INT NOT NULL,
        total_tokens INT NOT NULL,
        
        prompt_cost DECIMAL(10, 6) NOT NULL,
        completion_cost DECIMAL(10, 6) NOT NULL,
        total_cost DECIMAL(10, 6) NOT NULL,
        
        model VARCHAR(50) DEFAULT 'gpt-4o-mini',
        has_knowledge BOOLEAN DEFAULT false,
        knowledge_size INT DEFAULT 0,
        
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

        console.log('✅ Table iva_usage_tracking created successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        process.exit(0);
    }
}

migrate();
