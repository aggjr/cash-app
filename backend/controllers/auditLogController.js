const db = require('../config/database');

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

exports.listLogs = async (req, res, next) => {
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
