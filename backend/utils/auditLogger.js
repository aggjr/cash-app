const db = require('../config/database');

/**
 * Log an audit event
 * @param {Object} req - Express request object (to extract user/project info)
 * @param {String} action - CREATE, UPDATE, DELETE
 * @param {String} entity - Table name (entradas, saidas, etc)
 * @param {Number} entityId - ID of the record
 * @param {Object} details - JSON object with details (e.g. {old: ..., new: ...})
 */
const logAudit = async (req, action, entity, entityId, details = {}) => {
    try {
        if (!req.user) {
            console.warn('⚠️ AuditLogger: No user in request. Skipping log.');
            return;
        }

        const projectId = req.user.projectId;
        const userId = req.user.id;
        const userName = req.user.name || 'Unknown';

        const query = `
            INSERT INTO audit_logs (project_id, user_id, user_name, action, entity, entity_id, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const detailsJson = JSON.stringify(details);

        await db.query(query, [
            projectId,
            userId,
            userName,
            action,
            entity,
            entityId,
            detailsJson
        ]);

    } catch (error) {
        console.error('❌ AuditLogger Error:', error);
        // Do not throw, so main flow isn't interrupted
    }
};

module.exports = { logAudit };
