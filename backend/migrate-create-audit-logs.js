const db = require('./config/database');

const migrateCreateAuditLogs = async () => {
    let connection;
    try {
        connection = await db.getConnection();
        console.log('🔄 Checking if audit_logs table exists...');

        // Check if table exists
        const [rows] = await connection.query("SHOW TABLES LIKE 'audit_logs'");

        if (rows.length === 0) {
            console.log('✨ Creating audit_logs table...');
            await connection.query(`
                CREATE TABLE audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    project_id INT NOT NULL,
                    user_id INT,
                    user_name VARCHAR(255),
                    action VARCHAR(50) NOT NULL,
                    entity VARCHAR(50) NOT NULL,
                    entity_id INT,
                    details JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES projects(id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                    INDEX idx_project_date (project_id, created_at),
                    INDEX idx_entity (entity, entity_id)
                )
            `);
            console.log('✅ audit_logs table created successfully.');
        } else {
            console.log('ℹ️ audit_logs table already exists. Skipping.');
        }

    } catch (error) {
        console.error('❌ Migration audit_logs Failed:', error);
    } finally {
        if (connection) connection.release();
    }
};

module.exports = migrateCreateAuditLogs;
