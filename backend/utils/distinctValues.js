const db = require('../config/database');

/**
 * Builds an Express handler that returns the distinct values of a column for the
 * table filters. Values always come from the database for the whole project
 * (active rows only), never from the rows currently shown or paginated on screen.
 *
 * config.from       : table name (e.g. 'aportes')
 * config.alias      : table alias used in every expression (e.g. 'a')
 * config.extraWhere : optional extra SQL WHERE string (e.g. 's.loan_id IS NOT NULL')
 * config.fields     : { [fieldKey]: { expr, join?, type? } }
 *                     type: 'date' (formatted YYYY-MM-DD, nulls removed),
 *                           'number' (returned as Number, ordered desc) or text (default)
 */
const createDistinctValuesHandler = ({ from, alias, extraWhere: globalExtraWhere, fields }) => async (req, res, next) => {
    try {
        const { projectId, field } = req.query;

        if (!projectId || !field) {
            return res.status(400).json({ error: 'Missing projectId or field parameter' });
        }

        const def = Object.prototype.hasOwnProperty.call(fields, field) ? fields[field] : null;
        if (!def) return res.json([]);

        let select = def.expr;
        let extraWhere = globalExtraWhere ? ` AND ${globalExtraWhere}` : '';
        let order = 'val';

        if (def.type === 'date') {
            // Formatted in SQL so the day never shifts with timezone conversion.
            select = `DATE_FORMAT(${def.expr}, '%Y-%m-%d')`;
            extraWhere += ` AND ${def.expr} IS NOT NULL AND ${def.expr} <> '0000-00-00'`;
            order = 'val DESC';
        } else if (def.type === 'number') {
            order = 'val DESC';
        }

        const query = `
            SELECT DISTINCT ${select} AS val
            FROM ${from} ${alias}
            ${def.join || ''}
            WHERE ${alias}.project_id = ? AND ${alias}.active = 1${extraWhere}
            ORDER BY ${order}`;

        const [rows] = await db.query(query, [projectId]);
        res.json(rows.map(r => (def.type === 'number' && r.val !== null ? Number(r.val) : r.val)));
    } catch (error) {
        next(error);
    }
};

module.exports = { createDistinctValuesHandler };
