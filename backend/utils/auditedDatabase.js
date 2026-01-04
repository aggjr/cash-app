const { logAudit } = require('./auditLogger');

/**
 * Universal Database Audit Wrapper
 * Automatically logs all INSERT, UPDATE, DELETE operations to audit_logs
 * with complete old_data and new_data for undo capability
 */

// Parse SQL to extract operation type and table name
function parseSql(sql) {
    const normalized = sql.trim().replace(/\s+/g, ' ').toUpperCase();

    // INSERT
    if (normalized.startsWith('INSERT INTO')) {
        const match = sql.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
        return { operation: 'INSERT', table: match?.[1] };
    }

    // UPDATE
    if (normalized.startsWith('UPDATE')) {
        const match = sql.match(/UPDATE\s+`?(\w+)`?/i);
        return { operation: 'UPDATE', table: match?.[1] };
    }

    // DELETE
    if (normalized.startsWith('DELETE FROM')) {
        const match = sql.match(/DELETE\s+FROM\s+`?(\w+)`?/i);
        return { operation: 'DELETE', table: match?.[1] };
    }

    return { operation: 'SELECT', table: null };
}

// Extract WHERE clause to identify affected records
function extractWhereClause(sql) {
    const match = sql.match(/WHERE\s+(.+?)(?:$|ORDER|LIMIT|GROUP|;)/is);
    return match?.[1]?.trim();
}

// Extract ID from WHERE clause (e.g., "id = ?" or "id IN (1,2,3)")
function extractIdFromWhere(whereClause, params) {
    if (!whereClause) return null;

    // Match "id = ?" pattern
    if (/id\s*=\s*\?/i.test(whereClause)) {
        return params[0];
    }

    // Match "id = 123" pattern (literal)
    const literalMatch = whereClause.match(/id\s*=\s*(\d+)/i);
    if (literalMatch) {
        return parseInt(literalMatch[1]);
    }

    return null;
}

// Fetch old data before UPDATE/DELETE
async function fetchOldData(connection, table, whereClause, params) {
    try {
        if (!whereClause) return [];

        // Build SELECT query with same WHERE clause
        const selectSql = `SELECT * FROM ${table} WHERE ${whereClause}`;
        const [rows] = await connection.query(selectSql, params);
        return rows || [];
    } catch (error) {
        console.warn(`⚠️  Could not fetch old_data from ${table}:`, error.message);
        return [];
    }
}

// Fetch newly inserted data
async function fetchNewData(connection, table, insertId) {
    try {
        if (!insertId) return null;

        const [rows] = await connection.query(`SELECT * FROM ${table} WHERE id = ?`, [insertId]);
        return rows?.[0] || null;
    } catch (error) {
        console.warn(`⚠️  Could not fetch new_data from ${table}:`, error.message);
        return null;
    }
}

/**
 * Main audited query function
 * @param {Object} connection - Database connection (from pool or transaction)
 * @param {String} sql - SQL query
 * @param {Array} params - Query parameters
 * @param {Object} req - Express request object (for user context)
 * @returns {Promise} Query result
 */
async function auditedQuery(connection, sql, params = [], req = null) {
    const parsed = parseSql(sql);

    console.log('[AuditedQuery] ▶️ Query intercepted:', {
        operation: parsed.operation,
        table: parsed.table,
        hasReq: !!req,
        hasUser: !!(req && req.user)
    });

    // Skip audit for SELECT queries
    if (parsed.operation === 'SELECT') {
        return connection.query(sql, params);
    }

    // Skip audit_logs table itself (prevent recursion)
    if (parsed.table === 'audit_logs') {
        return connection.query(sql, params);
    }

    // Skip if no table identified
    if (!parsed.table) {
        return connection.query(sql, params);
    }

    let oldDataArray = [];
    const whereClause = extractWhereClause(sql);

    // Fetch old data for UPDATE/DELETE
    if ((parsed.operation === 'UPDATE' || parsed.operation === 'DELETE') && whereClause) {
        console.log('[AuditedQuery] 🔍 Fetching old_data before operation:', {
            operation: parsed.operation,
            table: parsed.table,
            whereClause
        });
        oldDataArray = await fetchOldData(connection, parsed.table, whereClause, params);
        console.log('[AuditedQuery] 📦 old_data fetched:', {
            count: oldDataArray.length,
            firstRecord: oldDataArray[0] || null
        });
    }

    // Execute original query
    const result = await connection.query(sql, params);

    // Log to audit if we have user context
    if (req && req.user && parsed.table) {
        console.log('[AuditedQuery] ✅ Conditions met for audit logging:', {
            operation: parsed.operation,
            table: parsed.table,
            user: req.user.name
        });
        try {
            if (parsed.operation === 'INSERT') {
                // For INSERT, fetch the newly created record
                const insertId = result[0]?.insertId;
                if (insertId) {
                    const newData = await fetchNewData(connection, parsed.table, insertId);
                    await logAudit(
                        req,
                        'CREATE',
                        parsed.table,
                        insertId,
                        { operation: 'insert' },
                        null,        // old_data (null for inserts)
                        newData      // new_data
                    );
                }
            } else if (parsed.operation === 'UPDATE' || parsed.operation === 'DELETE') {
                // Log each affected record
                for (const oldData of oldDataArray) {
                    const entityId = oldData.id;

                    // For UPDATE, fetch the updated data
                    let newData = null;
                    if (parsed.operation === 'UPDATE' && entityId) {
                        newData = await fetchNewData(connection, parsed.table, entityId);
                    }

                    await logAudit(
                        req,
                        parsed.operation,
                        parsed.table,
                        entityId,
                        {
                            operation: parsed.operation.toLowerCase(),
                            affectedRows: 1
                        },
                        oldData,     // old_data (complete record before change)
                        newData      // new_data (for UPDATE) or null (for DELETE)
                    );
                }
            }
        } catch (auditError) {
            // Don't fail the query if audit logging fails
            console.error('❌ Audit logging failed:', auditError);
        }
    }

    return result;
}

module.exports = { auditedQuery };
