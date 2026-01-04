const db = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');

const getOrderByClause = (sortBy, order = 'desc') => {
    const direction = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Mapping frontend sort keys to DB columns
    const map = {
        'id': 'log.id',
        'created_at': 'log.created_at',
        'user_name': 'u.name',
        'action': 'log.action',
        'entity': 'log.entity',
        'entity_id': 'log.entity_id'
    };

    return (map[sortBy] || 'log.created_at') + ' ' + direction;
};

exports.getAuditLogs = async (req, res, next) => {
    try {
        const { projectId, page = 1, limit = 50, search, sortBy, order } = req.query;

        // Base query conditions
        const conditions = ['log.project_id = ?'];
        const params = [projectId];

        // Search Filter
        if (search) {
            conditions.push('(u.name LIKE ? OR log.action LIKE ? OR log.entity LIKE ? OR log.details LIKE ?)');
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        // Date Range Filters (if passed by SharedTable)
        if (req.query.startDate) {
            conditions.push('log.created_at >= ?');
            params.push(req.query.startDate);
        }
        if (req.query.endDate) {
            conditions.push('log.created_at <= ?');
            params.push(req.query.endDate + ' 23:59:59');
        }

        const whereSql = 'WHERE ' + conditions.join(' AND ');

        // 1. Count Total
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM audit_logs log
            LEFT JOIN users u ON log.user_id = u.id
            ${whereSql}
        `;
        const [countRes] = await db.query(countQuery, params);
        const total = countRes[0].total;

        // 2. Fetch Data
        const offset = (page - 1) * limit;
        const dataQuery = `
            SELECT 
                log.*,
                u.name as user_name
            FROM audit_logs log
            LEFT JOIN users u ON log.user_id = u.id
            ${whereSql}
            ORDER BY ${getOrderByClause(sortBy, order)}
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(dataQuery, [...params, parseInt(limit), parseInt(offset)]);

        res.json({
            data: rows,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        next(error);
    }
};

// UNDO Action - Restore a deleted or updated record
exports.undoAction = async (req, res, next) => {
    let connection;
    try {
        const logId = req.params.id;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get audit log
        const [logs] = await connection.query(
            'SELECT * FROM audit_logs WHERE id = ? AND undone_at IS NULL',
            [logId]
        );

        if (logs.length === 0) {
            throw new AppError('RES-001', 'Log não encontrado ou já desfeito');
        }

        const log = logs[0];

        // Validate we have old_data
        if (!log.old_data) {
            throw new AppError('VAL-002', 'Este log não possui dados para restauração');
        }

        const oldData = JSON.parse(log.old_data);

        // Undo based on action
        if (log.action === 'DELETE') {
            // Restore deleted record
            const fields = Object.keys(oldData).filter(k => k !== 'id');
            const placeholders = fields.map(() => '?').join(', ');
            const values = fields.map(k => oldData[k]);

            // Insert with original ID
            const sql = `INSERT INTO ${log.entity} (id, ${fields.join(', ')}) VALUES (?, ${placeholders})`;
            await connection.query(sql, [log.entity_id, ...values]);

            // If it's an income/saida/etc with account and real date, restore balance
            if (oldData.account_id && oldData.data_real_recebimento && oldData.valor) {
                await connection.query(
                    `UPDATE contas SET current_balance = current_balance + ? WHERE id = ?`,
                    [oldData.valor, oldData.account_id]
                );
            }

        } else if (log.action === 'UPDATE') {
            // Restore old values
            const fields = Object.keys(oldData).filter(k => k !== 'id');
            const setClause = fields.map(f => `${f} = ?`).join(', ');
            const values = fields.map(f => oldData[f]);

            await connection.query(
                `UPDATE ${log.entity} SET ${setClause} WHERE id = ?`,
                [...values, log.entity_id]
            );
        } else {
            throw new AppError('VAL-002', `Ação '${log.action}' não pode ser desfeita`);
        }

        // Mark as undone
        await connection.query(
            'UPDATE audit_logs SET undone_at = NOW(), undone_by = ? WHERE id = ?',
            [req.user.id, logId]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Ação desfeita com sucesso',
            action: log.action,
            entity: log.entity,
            entity_id: log.entity_id
        });

    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

// Legacy alias
exports.listLogs = exports.getAuditLogs;
