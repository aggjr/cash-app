const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.listAportes = async (req, res, next) => {
    try {
        const { projectId, page = 1, limit = 50, search, startDate, endDate, minValue, maxValue } = req.query;

        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const offset = (page - 1) * limit;
        const params = [];
        let whereClauses = ['a.project_id = ?', 'a.active = 1'];
        params.push(projectId);

        // Dynamic Filtering
        if (startDate) {
            whereClauses.push('a.data_fato >= ?');
            params.push(startDate);
        }
        if (endDate) {
            whereClauses.push('a.data_fato <= ?');
            params.push(endDate);
        }
        if (minValue) {
            whereClauses.push('a.valor >= ?');
            params.push(minValue);
        }
        if (maxValue) {
            whereClauses.push('a.valor <= ?');
            params.push(maxValue);
        }
        if (search) {
            whereClauses.push('(a.descricao LIKE ? OR emp.name LIKE ? OR c.name LIKE ?)');
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count Total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM aportes a
            INNER JOIN empresas emp ON a.company_id = emp.id
            INNER JOIN contas c ON a.account_id = c.id
            ${whereSQL}`;

        const [countResult] = await db.query(countQuery, params);
        const totalItems = countResult[0].total;

        // Fetch Data
        const dataQuery = `
             SELECT 
                a.*,
                emp.name as company_name,
                emp.cnpj as company_cnpj,
                c.name as account_name,
                c.account_type as account_type
             FROM aportes a
             INNER JOIN empresas emp ON a.company_id = emp.id
             INNER JOIN contas c ON a.account_id = c.id
             ${whereSQL}
             ORDER BY a.data_fato DESC, a.created_at DESC
             LIMIT ? OFFSET ?`;

        const [aportes] = await db.query(dataQuery, [...params, parseInt(limit), parseInt(offset)]);

        res.json({
            data: aportes,
            meta: {
                total: totalItems,
                page: parseInt(page),
                pages: Math.ceil(totalItems / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.createAporte = async (req, res, next) => {
    let connection;
    try {
        const {
            dataFato,
            dataReal,
            valor,
            descricao,
            companyId,
            accountId,
            projectId
        } = req.body;

        if (!dataFato || !valor || !companyId || !accountId || !projectId) {
            throw new AppError('VAL-002');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO aportes 
            (data_fato, data_real, valor, descricao, company_id, account_id, project_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [dataFato, dataReal || null, valorDecimal, descricao, companyId, accountId, projectId]
        );

        // Update account balance
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [valorDecimal, accountId]
        );

        await connection.commit();

        res.status(201).json({
            id: result.insertId,
            data_fato: dataFato,
            data_real: dataReal || null,
            valor: valorDecimal,
            descricao,
            company_id: companyId,
            account_id: accountId,
            project_id: projectId,
            active: 1
        });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.updateAporte = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const {
            dataFato,
            dataReal,
            valor,
            descricao,
            companyId,
            accountId,
            active
        } = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get old aporte data
        const [oldAporte] = await connection.query(
            'SELECT valor, account_id FROM aportes WHERE id = ?',
            [id]
        );

        if (!oldAporte.length) {
            throw new AppError('RES-001', 'Aporte não encontrado.');
        }

        const updates = [];
        const values = [];

        if (dataFato !== undefined) {
            updates.push('data_fato = ?');
            values.push(dataFato);
        }
        if (dataReal !== undefined) {
            updates.push('data_real = ?');
            values.push(dataReal || null);
        }

        let newValor = oldAporte[0].valor;
        if (valor !== undefined) {
            const valorDecimal = parseFloat(valor);
            if (isNaN(valorDecimal)) {
                throw new AppError('VAL-001', 'Valor inválido.');
            }
            updates.push('valor = ?');
            values.push(valorDecimal);
            newValor = valorDecimal;
        }

        if (descricao !== undefined) {
            updates.push('descricao = ?');
            values.push(descricao);
        }
        if (companyId !== undefined) {
            updates.push('company_id = ?');
            values.push(companyId);
        }

        let newAccountId = oldAporte[0].account_id;
        if (accountId !== undefined) {
            updates.push('account_id = ?');
            values.push(accountId);
            newAccountId = accountId;
        }

        if (active !== undefined) {
            updates.push('active = ?');
            values.push(active);
        }

        if (updates.length > 0) {
            values.push(id);
            await connection.query(
                `UPDATE aportes SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Update balances if value or account changed
        // 1. Revert old transaction from old account
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [oldAporte[0].valor, oldAporte[0].account_id]
        );

        // 2. Apply new transaction to new account
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [newValor, newAccountId]
        );

        await connection.commit();
        res.json({ message: 'Aporte updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteAporte = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [aporte] = await connection.query(
            'SELECT valor, account_id FROM aportes WHERE id = ? AND active = 1',
            [id]
        );

        if (aporte.length === 0) {
            throw new AppError('RES-001', 'Aporte não encontrado.');
        }

        // Soft delete
        await connection.query('UPDATE aportes SET active = 0 WHERE id = ?', [id]);

        // Decrease account balance (reverse the injection)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [aporte[0].valor, aporte[0].account_id]
        );

        await connection.commit();
        res.json({ message: 'Aporte deleted successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};
