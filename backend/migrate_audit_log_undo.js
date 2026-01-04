const db = require('./config/database');

const migrateAuditLogUndo = async () => {
    let connection;
    try {
        connection = await db.getConnection();
        console.log('🔄 Migrating audit_logs table for undo capability...');

        // Check if columns already exist
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'audit_logs' 
            AND COLUMN_NAME IN ('old_data', 'new_data', 'undone_at', 'undone_by')
        `);

        const existingColumns = columns.map(c => c.COLUMN_NAME);

        if (existingColumns.length === 0) {
            console.log('✨ Adding undo columns to audit_logs...');

            await connection.query(`
                ALTER TABLE audit_logs
                ADD COLUMN old_data JSON DEFAULT NULL COMMENT 'Complete record before change',
                ADD COLUMN new_data JSON DEFAULT NULL COMMENT 'Complete record after change',
                ADD COLUMN undone_at TIMESTAMP NULL DEFAULT NULL COMMENT 'When this action was undone',
                ADD COLUMN undone_by INT NULL DEFAULT NULL COMMENT 'User who undid this action',
                ADD INDEX idx_undone (undone_at)
            `);

            console.log('✅ audit_logs table migrated successfully for undo capability.');
        } else {
            console.log('ℹ️ Undo columns already exist. Skipping:', existingColumns.join(', '));
        }

    } catch (error) {
        console.error('❌ Migration audit_logs undo failed:', error);
    } finally {
        if (connection) connection.release();
    }
};

module.exports = migrateAuditLogUndo;
