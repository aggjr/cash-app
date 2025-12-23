const db = require('../config/database');
const AppError = require('../utils/AppError');

const getOrderByClause = (sortBy, order = 'asc') => {
    const direction = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    switch (sortBy) {
        case 'valor':
            return `e.valor ${direction}`;
        case 'data_fato':
            return `e.data_fato ${direction}`;
        case 'data_prevista_recebimento':
            return `e.data_prevista_recebimento ${direction}`;
        case 'data_real_recebimento':
            return `e.data_real_recebimento ${direction}`;
        case 'data_atraso':
            return `e.data_atraso ${direction}`;
        case 'descricao':
            return `e.descricao ${direction}`;
        case 'tipo_entrada_name':
            return `th.full_path ${direction}`; // Sorting by joined column (nested path)
        case 'company_name':
            return `emp.name ${direction}`;
        case 'account_name':
            return `c.name ${direction}`;
        default:
            return `e.data_fato DESC, e.created_at DESC`;
    }
};

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

        // Dynamic Filtering - Specific Date Columns
        // Helper to handle date range
        const addDateFilter = (field, startParam, endParam) => {
            if (req.query[startParam]) {
                whereClauses.push(`e.${field} >= ?`);
                params.push(req.query[startParam]);
            }
            if (req.query[endParam]) {
                // For end date, ensure we include the whole day (23:59:59)
                whereClauses.push(`e.${field} <= ?`);
                params.push(`${req.query[endParam]} 23:59:59`);
            }
        };

        const addDateListFilter = (field, listParam) => {
            if (req.query[listParam]) {
                const dates = Array.isArray(req.query[listParam]) ? req.query[listParam] : [req.query[listParam]];
                if (dates.length > 0) {
                    // Use DATE() function to match regardless of time component
                    whereClauses.push(`DATE(e.${field}) IN (?)`);
                    params.push(dates);
                }
            }
        };

        addDateFilter('data_fato', 'data_fatoStart', 'data_fatoEnd');
        addDateListFilter('data_fato', 'data_fatoList');

        addDateFilter('data_prevista_recebimento', 'data_prevista_recebimentoStart', 'data_prevista_recebimentoEnd');
        addDateListFilter('data_prevista_recebimento', 'data_prevista_recebimentoList');

        addDateFilter('data_real_recebimento', 'data_real_recebimentoStart', 'data_real_recebimentoEnd');
        addDateListFilter('data_real_recebimento', 'data_real_recebimentoList');

        addDateFilter('data_atraso', 'data_atrasoStart', 'data_atrasoEnd');
        addDateListFilter('data_atraso', 'data_atrasoList');

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

        // Specific Text Filters
        if (req.query.description) {
            whereClauses.push('e.descricao LIKE ?');
            params.push(`%${req.query.description}%`);
        }
        if (req.query.account) {
            whereClauses.push('c.name LIKE ?');
            params.push(`%${req.query.account}%`);
        }
        if (req.query.company) {
            whereClauses.push('emp.name LIKE ?');
            params.push(`%${req.query.company}%`);
        }

        if (req.query.tipoEntrada) {
            whereClauses.push('th.full_path LIKE ?');
            params.push(`%${req.query.tipoEntrada}%`);
        }

        // Attachment Filter
        if (req.query.hasAttachment === '1') {
            whereClauses.push('e.comprovante_url IS NOT NULL AND e.comprovante_url != ""');
        } else if (req.query.hasAttachment === '0') {
            whereClauses.push('(e.comprovante_url IS NULL OR e.comprovante_url = "")');
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count Total
        const countQuery = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_entrada
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_entrada t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
            )
            SELECT COUNT(*) as total
            FROM entradas e
            LEFT JOIN TypeHierarchy th ON e.tipo_entrada_id = th.id
            INNER JOIN empresas emp ON e.company_id = emp.id
            LEFT JOIN contas c ON e.account_id = c.id
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
             LEFT JOIN contas c ON e.account_id = c.id
             ${whereSQL}
             ORDER BY 
             ${getOrderByClause(req.query.sortBy, req.query.order)}
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

// Helper functions for installment calculation
const calculateInstallments = (totalValue, count, type) => {
    if (type === 'total') return [totalValue];

    if (type === 'dividir') {
        // Divide the total value into equal parts
        const baseValue = Math.floor((totalValue * 100) / count) / 100;
        const remainder = Math.round((totalValue - (baseValue * count)) * 100) / 100;

        // First installment gets the remainder (rounding difference)
        const installments = [baseValue + remainder];
        for (let i = 1; i < count; i++) {
            installments.push(baseValue);
        }
        return installments;
    }

    if (type === 'replicar') {
        // Replicate the full value for each installment
        return Array(count).fill(totalValue);
    }

    return [totalValue];
};

const calculateDates = (baseDate, count, interval) => {
    const dates = [baseDate];

    for (let i = 1; i < count; i++) {
        const prevDate = new Date(dates[i - 1]);
        let nextDate;

        switch (interval) {
            case 'semanal':
                nextDate = new Date(prevDate);
                nextDate.setDate(prevDate.getDate() + 7);
                break;
            case 'quinzenal':
                nextDate = new Date(prevDate);
                nextDate.setDate(prevDate.getDate() + 15);
                break;
            case 'mensal':
                nextDate = new Date(prevDate);
                nextDate.setMonth(prevDate.getMonth() + 1);
                break;
            case 'trimestral':
                nextDate = new Date(prevDate);
                nextDate.setMonth(prevDate.getMonth() + 3);
                break;
            case 'semestral':
                nextDate = new Date(prevDate);
                nextDate.setMonth(prevDate.getMonth() + 6);
                break;
            case 'anual':
                nextDate = new Date(prevDate);
                nextDate.setFullYear(prevDate.getFullYear() + 1);
                break;
            default:
                nextDate = prevDate;
        }

        // Format to YYYY-MM-DD
        const year = nextDate.getFullYear();
        const month = String(nextDate.getMonth() + 1).padStart(2, '0');
        const day = String(nextDate.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }

    return dates;
};

exports.createIncome = async (req, res, next) => {
    let connection;
    try {
        const {
            dataFato,
            dataPrevistaRecebimento,
            dataRealRecebimento,
            dataAtraso,
            valor,
            descricao,
            tipoEntradaId,
            companyId,
            accountId,
            projectId,
            formaPagamento,
            comprovanteUrl,
            installmentType,
            installmentCount,
            installmentInterval
        } = req.body;

        // Validations
        if (!dataFato || !dataPrevistaRecebimento || !valor || !tipoEntradaId || !companyId || !projectId) {
            throw new AppError('VAL-002');
        }

        if (dataRealRecebimento && !accountId) {
            throw new AppError('VAL-002', 'Conta é obrigatória para recebimentos realizados.');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Determine installment parameters
        const type = installmentType || 'total';
        const count = (type === 'total') ? 1 : (parseInt(installmentCount) || 1);
        ```
        const interval = installmentInterval || 'mensal';

        // Calculate installments and dates
        const installmentValues = calculateInstallments(valorDecimal, count, type);
        const installmentDates = calculateDates(dataPrevistaRecebimento, count, interval);
        
        // Calculate fact dates based on type
        let factDates;
        if (type === 'replicar') {
            // For REPLICAR: data_fato increments with each interval (recorrente)
            factDates = calculateDates(dataFato, count, interval);
        } else {
            // For DIVIDIR or TOTAL: data_fato stays the same for all installments (parcelamento)
            factDates = Array(count).fill(dataFato);
        }

        const createdIds = [];

        // Create each installment
        for (let i = 0; i < count; i++) {
            const installmentDesc = count > 1
                ? `${ descricao || '' } - Parcela ${ i + 1 }/${count}`.trim()
                : descricao;

        const [result] = await connection.query(
            `INSERT INTO entradas 
                (data_fato, data_prevista_recebimento, data_real_recebimento, data_atraso, valor, descricao, tipo_entrada_id, company_id, account_id, project_id, comprovante_url, forma_pagamento) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                factDates[i],  // <- CHANGED: now uses calculated fact date
                installmentDates[i],
                dataRealRecebimento || null,
                dataAtraso || null,
                installmentValues[i],
                installmentDesc,
                tipoEntradaId,
                companyId,
                accountId,
                projectId,
                comprovanteUrl || null,
                formaPagamento || null
            ]
        );

        createdIds.push(result.insertId);

        // Update account balance only if there's a real receipt date
        if (dataRealRecebimento && accountId) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [installmentValues[i], accountId]
            );
        }
    }

        await connection.commit();

    res.status(201).json({
        success: true,
        ids: createdIds,
        count: createdIds.length,
        installmentType: type,
        message: count > 1
            ? `${count} ${type === 'dividir' ? 'parcelas criadas' : 'entradas recorrentes criadas'} com sucesso`
            : 'Entrada criada com sucesso'
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
            dataAtraso,
            valor,
            descricao,
            tipoEntradaId,
            companyId,
            accountId,
            comprovanteUrl,
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
        if (dataAtraso !== undefined) {
            updates.push('data_atraso = ?');
            values.push(dataAtraso || null);
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

        if (comprovanteUrl !== undefined) {
            updates.push('comprovante_url = ?');
            values.push(comprovanteUrl);
        }
        if (req.body.formaPagamento !== undefined) {
            updates.push('forma_pagamento = ?');
            values.push(req.body.formaPagamento || null);
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

