const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.listIncomes = async (req, res, next) => {
    try {
        const { projectId, page = 1, limit = 50, search, startDate, endDate, minValue, maxValue } = req.query;

        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const offset = (page - 1) * limit;
        const params = [];
        let whereClauses = ['e.project_id = ?', 'e.active = 1'];
        params.push(projectId);

        // Dynamic Filtering
        if (startDate) {
            whereClauses.push('e.data_fato >= ?');
            params.push(startDate);
        }
        if (endDate) {
            whereClauses.push('e.data_fato <= ?');
            params.push(endDate);
        }
        if (minValue) {
            whereClauses.push('e.valor >= ?');
            params.push(minValue);
        }
        if (maxValue) {
            whereClauses.push('e.valor <= ?');
            params.push(maxValue);
        }
        if (search) {
            whereClauses.push('(e.descricao LIKE ? OR emp.name LIKE ? OR c.name LIKE ?)');
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count Total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM entradas e
            INNER JOIN empresas emp ON e.company_id = emp.id
            INNER JOIN contas c ON e.account_id = c.id
            ${whereSQL}`;

        const [countResult] = await db.query(countQuery, params);
        const totalItems = countResult[0].total;

        // Fetch Data
        const dataQuery = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_entrada
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_entrada t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
             )
             SELECT 
                e.*,
                th.full_path as tipo_entrada_name,
                emp.name as company_name,
                emp.cnpj as company_cnpj,
                c.name as account_name,
                c.account_type as account_type
             FROM entradas e
             LEFT JOIN TypeHierarchy th ON e.tipo_entrada_id = th.id
             INNER JOIN empresas emp ON e.company_id = emp.id
             INNER JOIN contas c ON e.account_id = c.id
             ${whereSQL}
             ORDER BY e.data_fato DESC, e.created_at DESC
             LIMIT ? OFFSET ?`;

        const [incomes] = await db.query(dataQuery, [...params, parseInt(limit), parseInt(offset)]);

        res.json({
            data: incomes,
            meta: {
                total: totalItems,
                page: parseInt(page),
                pages: Math.ceil(totalItems / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('❌ listIncomes ERROR:', error.message);
        console.error('SQL State:', error.sqlState);
        console.error('SQL:', error.sql?.substring(0, 200));
        next(error);
    }
};

exports.createIncome = async (req, res, next) => {
    let connection;
    try {
        const {
            dataFato,
            dataPrevistaRecebimento,
            dataRealRecebimento,
            valor,
            descricao,
            tipoEntradaId,
            companyId,
            accountId,
            projectId
        } = req.body;

        if (!dataFato || !dataPrevistaRecebimento || !valor || !tipoEntradaId || !companyId || !accountId || !projectId) {
            throw new AppError('VAL-002');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO entradas 
            (data_fato, data_prevista_recebimento, data_real_recebimento, valor, descricao, tipo_entrada_id, company_id, account_id, project_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dataFato, dataPrevistaRecebimento, dataRealRecebimento || null, valorDecimal, descricao, tipoEntradaId, companyId, accountId, projectId]
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
            data_prevista_recebimento: dataPrevistaRecebimento,
            data_real_recebimento: dataRealRecebimento || null,
            valor: valorDecimal,
            descricao,
            tipo_entrada_id: tipoEntradaId,
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

exports.updateIncome = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const {
            dataFato,
            dataPrevistaRecebimento,
            dataRealRecebimento,
            valor,
            descricao,
            tipoEntradaId,
            companyId,
            accountId,
            active
        } = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get old income data
        const [oldIncome] = await connection.query(
            'SELECT valor, account_id FROM entradas WHERE id = ?',
            [id]
        );

        if (!oldIncome.length) {
            throw new AppError('RES-001', 'Entrada não encontrada.');
        }

        const updates = [];
        const values = [];

        if (dataFato !== undefined) {
            updates.push('data_fato = ?');
            values.push(dataFato);
        }
        if (dataPrevistaRecebimento !== undefined) {
            updates.push('data_prevista_recebimento = ?');
            values.push(dataPrevistaRecebimento);
        }
        if (dataRealRecebimento !== undefined) {
            updates.push('data_real_recebimento = ?');
            values.push(dataRealRecebimento || null);
        }

        let newValor = oldIncome[0].valor;
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
        if (tipoEntradaId !== undefined) {
            updates.push('tipo_entrada_id = ?');
            values.push(tipoEntradaId);
        }
        if (companyId !== undefined) {
            updates.push('company_id = ?');
            values.push(companyId);
        }

        let newAccountId = oldIncome[0].account_id;
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
                `UPDATE entradas SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Update balances if value or account changed
        // 1. Revert old transaction from old account
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [oldIncome[0].valor, oldIncome[0].account_id]
        );

        // 2. Apply new transaction to new account (even if same account, logic holds)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [newValor, newAccountId]
        );

        await connection.commit();
        res.json({ message: 'Income updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteIncome = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get income details first to know the amount and account
        const [income] = await connection.query(
            'SELECT valor, account_id FROM entradas WHERE id = ? AND active = 1',
            [id]
        );

        if (income.length === 0) {
            throw new AppError('RES-001', 'Entrada não encontrada.');
        }

        // Soft delete
        await connection.query('UPDATE entradas SET active = 0 WHERE id = ?', [id]);

        // Decrease account balance
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [income[0].valor, income[0].account_id]
        );

        await connection.commit();
        res.json({ message: 'Income deleted successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

