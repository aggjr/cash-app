const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.listRetiradas = async (req, res, next) => {
    try {
        const { projectId, page = 1, limit = 50, search, startDate, endDate, minValue, maxValue } = req.query;
        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const offset = (page - 1) * limit;
        const queryParams = [projectId];

        let query = `
            SELECT r.*, e.name as company_name, c.name as account_name 
            FROM retiradas r
            LEFT JOIN empresas e ON r.company_id = e.id
            LEFT JOIN contas c ON r.account_id = c.id
            WHERE r.project_id = ? AND r.active = 1
        `;

        // Filters
        if (search) {
            query += ` AND (r.descricao LIKE ? OR e.name LIKE ? OR c.name LIKE ?)`;
            const term = `%${search}%`;
            queryParams.push(term, term, term);
        }
        if (startDate) {
            query += ` AND r.data_fato >= ?`;
            queryParams.push(startDate);
        }
        if (endDate) {
            query += ` AND r.data_fato <= ?`;
            queryParams.push(endDate);
        }
        if (minValue) {
            query += ` AND r.valor >= ?`;
            queryParams.push(minValue);
        }
        if (maxValue) {
            query += ` AND r.valor <= ?`;
            queryParams.push(maxValue);
        }

        // Count
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        // We reuse query construction but simplistic usually works or verify performance later.
        // Actually simpler to just run the count on the base tables with same WHEREs.
        // For simplicity in this specialized agent context, let's just execute the full count query logic if needed or just use SQL_CALC_FOUND_ROWS if MySQL 5.7, but standard count is better.

        // Sorting
        query += ` ORDER BY r.data_fato DESC, r.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.query(query, queryParams);

        // Count total for pagination
        // Re-construct WHERE clause for count
        let whereClause = 'WHERE r.project_id = ? AND r.active = 1';
        const countParams = [projectId];
        if (search) {
            whereClause += ` AND (r.descricao LIKE ? OR e.name LIKE ? OR c.name LIKE ?)`;
            const term = `%${search}%`;
            countParams.push(term, term, term);
        }
        if (startDate) { whereClause += ` AND r.data_fato >= ?`; countParams.push(startDate); }
        if (endDate) { whereClause += ` AND r.data_fato <= ?`; countParams.push(endDate); }
        if (minValue) { whereClause += ` AND r.valor >= ?`; countParams.push(minValue); }
        if (maxValue) { whereClause += ` AND r.valor <= ?`; countParams.push(maxValue); }

        const [countResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM retiradas r
            LEFT JOIN empresas e ON r.company_id = e.id
            LEFT JOIN contas c ON r.account_id = c.id
            ${whereClause}
        `, countParams);

        res.json({
            data: rows,
            meta: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.createRetirada = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { dataFato, dataPrevista, dataReal, valor, descricao, companyId, accountId, projectId } = req.body;

        if (!dataFato || !valor || !companyId || !accountId || !projectId) {
            throw new AppError('VAL-002', 'Datas, Valor, Empresa, Conta e Projeto são obrigatórios');
        }

        // Insert Retirada
        const [result] = await connection.query(
            `INSERT INTO retiradas (data_fato, data_prevista, data_real, valor, descricao, company_id, account_id, project_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [dataFato, dataPrevista || null, dataReal || null, valor, descricao, companyId, accountId, projectId]
        );

        const newId = result.insertId;

        // Decrease Account Balance (It's a withdrawal)
        // Ensure valor is positive number for correct math logic, assuming UI sends positive "100" for a 100 withdrawal.
        // Balances are simple: Balance = In - Out.
        // We are just updating the current_balance snapshot.
        const valorDecimal = parseFloat(valor);

        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [valorDecimal, accountId]
        );

        await connection.commit();

        res.status(201).json({
            id: newId,
            message: 'Retirada criada com sucesso'
        });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

exports.updateRetirada = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { dataFato, dataPrevista, dataReal, valor, descricao, companyId, accountId, active } = req.body;

        // Get old data to revert balance
        const [oldRetirada] = await connection.query('SELECT * FROM retiradas WHERE id = ?', [id]);
        if (oldRetirada.length === 0) {
            throw new AppError('RES-001', 'Retirada não encontrada');
        }
        const oldData = oldRetirada[0];

        // Prepare updates
        const updates = [];
        const values = [];

        if (dataFato !== undefined) { updates.push('data_fato = ?'); values.push(dataFato); }
        if (dataPrevista !== undefined) { updates.push('data_prevista = ?'); values.push(dataPrevista); }
        if (dataReal !== undefined) { updates.push('data_real = ?'); values.push(dataReal); }
        if (valor !== undefined) { updates.push('valor = ?'); values.push(valor); }
        if (descricao !== undefined) { updates.push('descricao = ?'); values.push(descricao); }
        if (companyId !== undefined) { updates.push('company_id = ?'); values.push(companyId); }
        if (accountId !== undefined) { updates.push('account_id = ?'); values.push(accountId); }
        if (active !== undefined) { updates.push('active = ?'); values.push(active); }

        if (updates.length > 0) {
            values.push(id);
            await connection.query(`UPDATE retiradas SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        // Handle Balance Updates if Value or Account Changed or Activation Changed
        // Simplest strategy: Revert old, Apply new.

        // 1. Revert Old (Increase balance back)
        if (oldData.active) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [oldData.valor, oldData.account_id]
            );
        }

        // 2. Apply New (Decrease balance)
        const newActive = active !== undefined ? active : oldData.active;
        if (newActive) {
            const newValor = valor !== undefined ? parseFloat(valor) : parseFloat(oldData.valor);
            const newAccountId = accountId !== undefined ? accountId : oldData.account_id;

            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [newValor, newAccountId]
            );
        }

        await connection.commit();
        res.json({ message: 'Retirada atualizada com sucesso' });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

exports.deleteRetirada = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [retirada] = await connection.query('SELECT * FROM retiradas WHERE id = ?', [id]);
        if (retirada.length === 0) {
            throw new AppError('RES-001', 'Retirada não encontrada');
        }

        // Soft delete
        await connection.query('UPDATE retiradas SET active = 0 WHERE id = ?', [id]);

        // Increase account balance (reverse the withdrawal)
        if (retirada[0].active) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [retirada[0].valor, retirada[0].account_id]
            );
        }

        await connection.commit();
        res.json({ message: 'Retirada excluída com sucesso' });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};
