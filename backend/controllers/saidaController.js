const db = require('../config/database');
const AppError = require('../utils/AppError');
const { validateDateWithinRange } = require('../utils/dateValidation');

// Helper function to generate dynamic ORDER BY clause
const getOrderByClause = (sortBy, order = 'desc') => {
    const validOrders = ['asc', 'desc'];
    const orderDirection = validOrders.includes(order?.toLowerCase()) ? order.toUpperCase() : 'DESC';

    const orderMappings = {
        'valor': `s.valor ${orderDirection}`,
        'data_fato': `s.data_fato ${orderDirection}`,
        'data_prevista_pagamento': `s.data_prevista_pagamento ${orderDirection}`,
        'data_real_pagamento': `s.data_real_pagamento ${orderDirection}`,
        'data_prevista_atraso': `s.data_prevista_atraso ${orderDirection}`,
        'descricao': `s.descricao ${orderDirection}`,
        'tipo_saida_name': `th.full_path ${orderDirection}`,
        'company_name': `emp.name ${orderDirection}`,
        'account_name': `c.name ${orderDirection}`
    };

    return orderMappings[sortBy] || 's.data_fato DESC, s.created_at DESC';
};

exports.listSaidas = async (req, res, next) => {
    try {
        const { projectId, search, minValue, maxValue, sortBy, order } = req.query;

        if (!projectId) {
            throw new AppError('VAL-002', `Debug: query=${JSON.stringify(req.query)}, projectId=${projectId}`);
        }

        let whereClauses = ['s.project_id = ?', 's.active = 1'];
        let params = [projectId];

        // Dynamic Filtering - Specific Date Columns
        const addDateFilter = (field, startParam, endParam) => {
            if (req.query[startParam]) {
                whereClauses.push(`s.${field} >= ?`);
                params.push(req.query[startParam]);
            }
            if (req.query[endParam]) {
                whereClauses.push(`s.${field} <= ?`);
                params.push(`${req.query[endParam]} 23:59:59`);
            }
        };

        const addDateListFilter = (field, listParam) => {
            if (req.query[listParam]) {
                const dates = Array.isArray(req.query[listParam]) ? req.query[listParam] : [req.query[listParam]];
                if (dates.length > 0) {
                    whereClauses.push(`DATE(s.${field}) IN (?)`);
                    params.push(dates);
                }
            }
        };

        addDateFilter('data_fato', 'data_fatoStart', 'data_fatoEnd');
        addDateListFilter('data_fato', 'data_fatoList');

        addDateFilter('data_prevista_pagamento', 'data_prevista_pagamentoStart', 'data_prevista_pagamentoEnd');
        addDateListFilter('data_prevista_pagamento', 'data_prevista_pagamentoList');

        addDateFilter('data_real_pagamento', 'data_real_pagamentoStart', 'data_real_pagamentoEnd');
        addDateListFilter('data_real_pagamento', 'data_real_pagamentoList');

        addDateFilter('data_prevista_atraso', 'data_prevista_atrasoStart', 'data_prevista_atrasoEnd');
        addDateListFilter('data_prevista_atraso', 'data_prevista_atrasoList');

        if (minValue) {
            whereClauses.push('s.valor >= ?');
            params.push(minValue);
        }
        if (maxValue) {
            whereClauses.push('s.valor <= ?');
            params.push(maxValue);
        }
        if (search) {
            whereClauses.push('(s.descricao LIKE ? OR emp.name LIKE ? OR c.name LIKE ?)');
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        // Specific Text Filters
        if (req.query.description) {
            whereClauses.push('s.descricao LIKE ?');
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

        if (req.query.tipoSaida) {
            whereClauses.push('th.full_path LIKE ?');
            params.push(`%${req.query.tipoSaida}%`);
        }

        // Attachment Filter
        if (req.query.hasAttachment === '1') {
            whereClauses.push('s.comprovante_url IS NOT NULL AND s.comprovante_url != ""');
        } else if (req.query.hasAttachment === '0') {
            whereClauses.push('(s.comprovante_url IS NULL OR s.comprovante_url = "")');
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count Total
        const countQuery = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_saida
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_saida t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
            )
            SELECT COUNT(*) as total
            FROM saidas s
            LEFT JOIN TypeHierarchy th ON s.tipo_saida_id = th.id
            INNER JOIN empresas emp ON s.company_id = emp.id
            LEFT JOIN contas c ON s.account_id = c.id
            ${whereSQL}`;

        const [countResult] = await db.query(countQuery, params);
        const totalItems = countResult[0].total;

        // Fetch Data
        const dataQuery = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_saida
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_saida t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
             )
             SELECT 
                s.*,
                th.full_path as tipo_saida_name,
                emp.name as company_name,
                emp.cnpj as company_cnpj,
                c.name as account_name,
                c.account_type as account_type
             FROM saidas s
             LEFT JOIN TypeHierarchy th ON s.tipo_saida_id = th.id
             INNER JOIN empresas emp ON s.company_id = emp.id
             LEFT JOIN contas c ON s.account_id = c.id
             ${whereSQL}
             ORDER BY 
             ${getOrderByClause(sortBy, order)}`;

        const [saidas] = await db.query(dataQuery, params);

        res.json(saidas);
    } catch (error) {
        next(error);
    }
};

exports.createSaida = async (req, res, next) => {
    let connection;
    try {
        const {
            dataFato,
            dataPrevistaPagamento,
            dataRealPagamento,
            valor,
            descricao,
            tipoSaidaId,
            companyId,
            accountId,
            projectId,
            comprovanteUrl,
            formaPagamento
        } = req.body;

        if (!dataFato || !dataPrevistaPagamento || !valor || !tipoSaidaId || !companyId || !projectId) {
            throw new AppError('VAL-002');
        }

        if (dataRealPagamento && !accountId) {
            throw new AppError('VAL-002', 'Conta é obrigatória para pagamentos realizados.');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        // Validate dataRealPagamento if provided
        if (dataRealPagamento) {
            const validation = await validateDateWithinRange(dataRealPagamento, projectId);
            if (!validation.isValid) {
                throw new AppError('VAL-DATE', validation.error);
            }
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO saidas 
            (data_fato, data_prevista_pagamento, data_real_pagamento, valor, descricao, tipo_saida_id, company_id, account_id, project_id, comprovante_url, forma_pagamento) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dataFato, dataPrevistaPagamento, dataRealPagamento || null, valorDecimal, descricao, tipoSaidaId, companyId, accountId, projectId, comprovanteUrl || null, formaPagamento || null]
        );

        // Update account balance - SUBTRACT for expenses
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [valorDecimal, accountId]
        );

        await connection.commit();

        res.status(201).json({
            id: result.insertId,
            data_fato: dataFato,
            data_prevista_pagamento: dataPrevistaPagamento,
            data_real_pagamento: dataRealPagamento || null,
            valor: valorDecimal,
            descricao,
            tipo_saida_id: tipoSaidaId,
            company_id: companyId,
            account_id: accountId,
            project_id: projectId,
            comprovante_url: comprovanteUrl || null,
            forma_pagamento: formaPagamento || null,
            active: 1
        });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.updateSaida = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const {
            dataFato,
            dataPrevistaPagamento,
            dataRealPagamento,
            valor,
            descricao,
            tipoSaidaId,
            companyId,
            accountId,
            active,
            comprovanteUrl,
            formaPagamento
        } = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get old saida data
        const [oldSaida] = await connection.query(
            'SELECT valor, account_id FROM saidas WHERE id = ?',
            [id]
        );

        if (!oldSaida.length) {
            throw new AppError('RES-001', 'Saída não encontrada.');
        }

        // Validate dataRealPagamento if provided
        if (dataRealPagamento !== undefined && dataRealPagamento !== null) {
            const validation = await validateDateWithinRange(dataRealPagamento, req.user.projectId);
            if (!validation.isValid) {
                throw new AppError('VAL-DATE', validation.error);
            }
        }

        const updates = [];
        const values = [];

        if (dataFato !== undefined) {
            updates.push('data_fato = ?');
            values.push(dataFato);
        }
        if (dataPrevistaPagamento !== undefined) {
            updates.push('data_prevista_pagamento = ?');
            values.push(dataPrevistaPagamento);
        }
        if (dataRealPagamento !== undefined) {
            updates.push('data_real_pagamento = ?');
            values.push(dataRealPagamento || null);
        }

        let newValor = oldSaida[0].valor;
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
        if (tipoSaidaId !== undefined) {
            updates.push('tipo_saida_id = ?');
            values.push(tipoSaidaId);
        }
        if (companyId !== undefined) {
            updates.push('company_id = ?');
            values.push(companyId);
        }

        let newAccountId = oldSaida[0].account_id;
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
            values.push(comprovanteUrl || null);
        }

        if (formaPagamento !== undefined) {
            updates.push('forma_pagamento = ?');
            values.push(formaPagamento || null);
        }

        if (updates.length > 0) {
            values.push(id);
            await connection.query(
                `UPDATE saidas SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Update balances if value or account changed
        // 1. Revert old transaction from old account (ADD back the expense)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [oldSaida[0].valor, oldSaida[0].account_id]
        );

        // 2. Apply new transaction to new account (SUBTRACT the new expense)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [newValor, newAccountId]
        );

        await connection.commit();
        res.json({ message: 'Saída updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteSaida = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get saida details first to know the amount and account
        const [saida] = await connection.query(
            'SELECT valor, account_id FROM saidas WHERE id = ? AND active = 1',
            [id]
        );

        if (saida.length === 0) {
            throw new AppError('RES-001', 'Saída não encontrada.');
        }

        // Soft delete
        await connection.query('UPDATE saidas SET active = 0 WHERE id = ?', [id]);

        // Increase account balance (revert the expense - ADD back the money)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [saida[0].valor, saida[0].account_id]
        );

        await connection.commit();
        res.json({ message: 'Saída deleted successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};
