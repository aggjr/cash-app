const pool = require('../config/database').pool; // Get raw pool, not wrapper

/**
 * Log an audit event
 * @param {Object} req - Express request object (to extract user/project info)
 * @param {String} action - CREATE, UPDATE, DELETE
 * @param {String} entity - Table name (entradas, saidas, etc)
 * @param {Number} entityId - ID of the record
 * @param {Object} details - JSON object with details (e.g. {old: ..., new: ...})
 * @param {Object} oldData - Complete record before change (for UNDO)
 * @param {Object} newData - Complete record after change (for UNDO)
 */
const logAudit = async (req, action, entity, entityId, details = {}, oldData = null, newData = null) => {
    try {
        if (!req.user) {
            console.warn('⚠️ AuditLogger: No user in request. Skipping log.');
            return;
        }

        const projectId = req.user.projectId;
        const userId = req.user.id;
        const userName = req.user.name || 'Unknown';

        const query = `
            INSERT INTO audit_logs (project_id, user_id, user_name, action, entity, entity_id, details, old_data, new_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const detailsJson = JSON.stringify(details);
        const oldDataJson = oldData ? JSON.stringify(oldData) : null;
        const newDataJson = newData ? JSON.stringify(newData) : null;

        // Use RAW pool.query (not db.query) to avoid circular reference with auditedQuery
        await pool.query(query, [
            projectId,
            userId,
            userName,
            action,
            entity,
            entityId,
            detailsJson,
            oldDataJson,
            newDataJson
        ]);

    } catch (error) {
        console.error('❌ AuditLogger Error:', error);
        // Do not throw, so main flow isn't interrupted
    }
};

module.exports = { logAudit };
