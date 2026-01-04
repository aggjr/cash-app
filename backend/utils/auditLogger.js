const pool = require('../config/database').pool; // Get raw pool, not wrapper

// DIAGNOSTIC LOG - Check if pool loaded correctly
console.log('[AuditLogger] Pool loaded:', {
    poolExists: !!pool,
    poolType: typeof pool,
    hasQuery: pool && typeof pool.query === 'function'
});

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
    console.log('[AuditLogger] ▶️ logAudit CALLED:', {
        action,
        entity,
        entityId,
        hasReq: !!req,
        hasUser: !!(req && req.user),
        poolCheck: !!pool
    });

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
        console.log('[AuditLogger] 🔍 About to execute pool.query:', {
            poolExists: !!pool,
            poolQueryType: pool && typeof pool.query,
            entity,
            action
        });

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

        console.log('[AuditLogger] ✅ Audit log inserted successfully:', { entity, action });

    } catch (error) {
        console.error('❌ AuditLogger Error:', error);
        // Do not throw, so main flow isn't interrupted
    }
};

module.exports = { logAudit };
