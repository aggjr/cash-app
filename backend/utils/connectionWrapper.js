const { auditedQuery } = require('../utils/auditedDatabase');

/**
 * Helper to wrap a database connection with audit logging
 * Use this for transactions to enable automatic audit logging
 * 
 * @param {Object} connection - MySQL connection from pool.getConnection()
 * @param {Object} req - Express request object (for user context)
 * @returns {Object} Wrapped connection with auditedQuery method
 * 
 * @example
 * const connection = await db.getConnection();
 * const audited = wrapConnectionWithAudit(connection, req);
 * 
 * await audited.beginTransaction();
 * await audited.query('UPDATE entradas SET...', [...]); // Auto-logged!
 * await audited.commit();
 */
function wrapConnectionWithAudit(connection, req) {
    return {
        // Wrap query to use auditedQuery
        query: (sql, params) => auditedQuery(connection, sql, params, req),

        // Pass through other methods
        beginTransaction: () => connection.beginTransaction(),
        commit: () => connection.commit(),
        rollback: () => connection.rollback(),
        release: () => connection.release(),

        // Expose original connection if needed
        _connection: connection
    };
}

module.exports = { wrapConnectionWithAudit };
